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
const matrix = require('./matrix')
const heartbeat = require('./heartbeat')


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
        heartbeat.stopHeartbeat(this)
        this.log('debug', 'destroy')
    }

    async configUpdated(config) {
        this.config = config
        await this.authenticate()
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

	startHeartbeat() {
        heartbeat.startHeartbeat(this)
        this.heartbeatInterval = setInterval(async () => {
            const result = await heartbeat.sendHeartbeat(this)
            if (result) {
                this.authHeader = result.authHeader
                this.csrfToken = result.csrfToken
            }
        }, 60000) // 60 seconds
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
}

runEntrypoint(ModuleInstance, UpgradeScripts)