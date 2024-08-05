const { InstanceBase, Regex, runEntrypoint, InstanceStatus } = require('@companion-module/base')
const UpgradeScripts = require('./upgrades')
const UpdateActions = require('./actions')
const UpdateFeedbacks = require('./feedbacks')
const UpdateVariableDefinitions = require('./variables')
const http = require('http')
const crypto = require('crypto')
const { getConfigFields } = require('./config')
const auth = require('./auth')
const { makeRequest } = require('./api')


class ModuleInstance extends InstanceBase {
    constructor(internal) {
        super(internal)
        this.authHeader = null
        this.csrfToken = null
        this.realm = null
        this.nonce = null
        this.ncCounter = 1
        this.heartbeatInterval = null
    }

    async init(config) {
        this.config = config
        this.updateStatus(InstanceStatus.Ok)
        this.updateActions()
        this.updateFeedbacks()
        this.updateVariableDefinitions()
        this.log('info', 'Initializing module')
        await this.authenticate()
        this.startHeartbeat()
    }

	async destroy() {
		this.stopHeartbeat()
		this.log('debug', 'destroy')
	}

	async configUpdated(config) {
        this.config = config
        await this.authenticate(this)
        this.startHeartbeat()
    }
	async authenticate() {
        const result = await auth.authenticate(this)
        if (result) {
            this.authHeader = result.authHeader
            this.csrfToken = result.csrfToken
            this.realm = result.realm
            this.nonce = result.nonce
            return true
        }
        return false
    }

	getConfigFields() {
        return getConfigFields()
    }

	updateActions() {
		UpdateActions(this)
	}

	updateFeedbacks() {
		UpdateFeedbacks(this)
	}

	updateVariableDefinitions() {
		UpdateVariableDefinitions(this)
	}

	md5(data) {
        return auth.md5(data)
    }

    digestAuth(method, uri, realm, nonce, username, password) {
        return auth.digestAuth(method, uri, realm, nonce, username, password, this.ncCounter++)
    }

    makeRequest(options, body = null) {
        return makeRequest(options, body)
    }

	

	async makeMatrixRequest(outputId, inputId) {
        this.log('info', `Making matrix request: ${outputId} -> ${inputId}`)
        if (!this.authHeader || !this.csrfToken) {
            this.log('info', 'Auth header or CSRF token missing, re-authenticating')
            if (!(await this.authenticate())) {
                this.log('error', 'Re-authentication failed')
                return false
            }
        }

        const body = `<updateRuntime><base><output id="${outputId}">${inputId}</output></base></updateRuntime>`

        // Generate a new authorization header specifically for this request
        const newAuthHeader = auth.digestAuth('POST', '/api/matrix', this.realm, this.nonce, this.config.username, this.config.password, this.ncCounter++)

        const options = {
            hostname: this.config.host,
            port: 8080,
            path: '/api/matrix',
            method: 'POST',
            headers: {
                'Accept': '*/*',
                'Accept-Encoding': 'gzip, deflate',
                'Accept-Language': 'en-US,en;q=0.9',
                'Connection': 'keep-alive',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'Content-Length': Buffer.byteLength(body),
                'Host': `${this.config.host}:8080`,
                'Origin': `http://${this.config.host}:8080`,
                'Referer': `http://${this.config.host}:8080/assets/base/home.html`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
                'X-CSRF-Token': this.csrfToken,
                'X-Requested-With': 'XMLHttpRequest',
                'Authorization': newAuthHeader
            }
        }

		this.log('info', `Sending matrix request to ${options.hostname}:${options.port}`)
		this.log('info', `Request headers: ${JSON.stringify(options.headers)}`)
		this.log('info', `Request body: ${body}`)

		try {
			const response = await this.makeRequest(options, body)
			this.log('info', `Matrix response status: ${response.statusCode}`)
			this.log('info', `Response headers: ${JSON.stringify(response.headers)}`)
			this.log('info', `Response body: ${response.data}`)
			
			if (response.statusCode === 200) {
				this.log('info', `Matrix request successful: ${outputId} -> ${inputId}`)
				return true
			} else {
				this.log('error', `Matrix request failed with status ${response.statusCode}`)
				return false
			}
		} catch (error) {
			this.log('error', 'Matrix request error: ' + error.message)
			return false
		}
	}

	async disableMatrixOutput(outputId) {
		this.log('info', `Disabling matrix output: ${outputId}`)
		if (!this.authHeader || !this.csrfToken) {
			this.log('info', 'Auth header or CSRF token missing, re-authenticating')
			await this.authenticate()
		}

		const body = `<updateRuntime><base><output id="${outputId}"></output></base></updateRuntime>`

		// Extract realm and nonce from the existing authHeader
		const realm = this.authHeader.match(/realm="([^"]+)"/)[1]
		const nonce = this.authHeader.match(/nonce="([^"]+)"/)[1]

		// Generate a new authorization header specifically for this request
		const newAuthHeader = auth.digestAuth('POST', '/api/matrix', realm, nonce, this.config.username, this.config.password)

		const options = {
			hostname: this.config.host,
			port: 8080,
			path: '/api/matrix',
			method: 'POST',
			headers: {
				'Accept': '*/*',
				'Accept-Encoding': 'gzip, deflate',
				'Accept-Language': 'en-US,en;q=0.9',
				'Connection': 'keep-alive',
				'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
				'Content-Length': Buffer.byteLength(body),
				'Host': `${this.config.host}:8080`,
				'Origin': `http://${this.config.host}:8080`,
				'Referer': `http://${this.config.host}:8080/assets/base/home.html`,
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
				'X-CSRF-Token': this.csrfToken,
				'X-Requested-With': 'XMLHttpRequest',
				'Authorization': newAuthHeader
			}
		}

		this.log('info', `Sending disable matrix request to ${options.hostname}:${options.port}`)
		this.log('info', `Request headers: ${JSON.stringify(options.headers)}`)
		this.log('info', `Request body: ${body}`)

		try {
			const response = await this.makeRequest(options, body)
			this.log('info', `Disable matrix response status: ${response.statusCode}`)
			this.log('info', `Response headers: ${JSON.stringify(response.headers)}`)
			this.log('info', `Response body: ${response.data}`)
			
			if (response.statusCode === 200) {
				this.log('info', `Matrix output disabled successfully: ${outputId}`)
				return true
			} else {
				this.log('error', `Failed to disable matrix output with status ${response.statusCode}`)
				return false
			}
		} catch (error) {
			this.log('error', 'Disable matrix request error: ' + error.message)
			return false
		}
	}

	startHeartbeat() {
		this.stopHeartbeat() // Ensure we don't have multiple intervals running
		this.heartbeatInterval = setInterval(() => {
			this.sendHeartbeat()
		}, 60000) // 60 seconds
	}

	stopHeartbeat() {
		if (this.heartbeatInterval) {
			clearInterval(this.heartbeatInterval)
			this.heartbeatInterval = null
		}
	}

	async sendHeartbeat() {
		const path = '/api/ppm?skip=0&width=8&interval=50&version=1&c=enc1&c=enc2&c=enc3&c=enc4&c=enc5&c=enc6&c=enc7&c=enc8&c=enc9&c=enc10&c=enc11&c=enc12&c=enc13&c=enc14&c=enc15&c=enc16&c=dec1&c=dec2&c=dec3&c=dec4&c=dec5&c=dec6&c=dec7&c=dec8&c=dec9&c=dec10&c=dec11&c=dec12&c=dec13&c=dec14&c=dec15&c=dec16&c=hpl&c=hpr'
		
		if (!this.authHeader || !this.csrfToken) {
			this.log('info', 'Auth header or CSRF token missing, re-authenticating')
			await this.authenticate()
		}

		const realm = this.authHeader.match(/realm="([^"]+)"/)[1]
		const nonce = this.authHeader.match(/nonce="([^"]+)"/)[1]
		const newAuthHeader = auth.digestAuth('GET', path, realm, nonce, this.config.username, this.config.password)

		const options = {
			hostname: this.config.host,
			port: 8080,
			path: path,
			method: 'GET',
			headers: {
				'Accept': '*/*',
				'Accept-Language': 'en-US,en;q=0.9',
				'Authorization': newAuthHeader,
				'Cache-Control': 'no-cache',
				'Pragma': 'no-cache',
				'X-CSRF-Token': this.csrfToken,
				'Referer': `http://${this.config.host}:8080/assets/base/home.html`
			}
		}

		try {
			const response = await this.makeRequest(options)
			if (response.statusCode === 200) {
				this.log('debug', 'Heartbeat successful')
				// You could potentially update some variables or feedbacks here based on the PPM data
			} else {
				this.log('Info', `Heartbeat failed with status ${response.statusCode}`)
				if (response.statusCode === 401) {
					this.log('info', 'Re-authenticating due to 401 response')
					await this.authenticate()
				}
			}
		} catch (error) {
			this.log('error', 'Heartbeat error: ' + error.message)
		}
	}
}

runEntrypoint(ModuleInstance, UpgradeScripts)