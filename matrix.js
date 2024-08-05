const auth = require('./auth')
const { makeRequest } = require('./api')

module.exports = {
    async makeMatrixRequest(instance, outputId, inputId) {
        instance.log('info', `Making matrix request: ${outputId} -> ${inputId}`)
        if (!instance.authHeader || !instance.csrfToken) {
            instance.log('info', 'Auth header or CSRF token missing, re-authenticating')
            if (!(await instance.authenticate())) {
                instance.log('error', 'Re-authentication failed')
                return false
            }
        }

        const body = `<updateRuntime><base><output id="${outputId}">${inputId}</output></base></updateRuntime>`

        // Generate a new authorization header specifically for this request
        const newAuthHeader = auth.digestAuth('POST', '/api/matrix', instance.realm, instance.nonce, instance.config.username, instance.config.password, instance.ncCounter++)

        const options = {
            hostname: instance.config.host,
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
                'Host': `${instance.config.host}:8080`,
                'Origin': `http://${instance.config.host}:8080`,
                'Referer': `http://${instance.config.host}:8080/assets/base/home.html`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
                'X-CSRF-Token': instance.csrfToken,
                'X-Requested-With': 'XMLHttpRequest',
                'Authorization': newAuthHeader
            }
        }

        instance.log('info', `Sending matrix request to ${options.hostname}:${options.port}`)
        instance.log('info', `Request headers: ${JSON.stringify(options.headers)}`)
        instance.log('info', `Request body: ${body}`)

        try {
            const response = await makeRequest(options, body)
            instance.log('info', `Matrix response status: ${response.statusCode}`)
            instance.log('info', `Response headers: ${JSON.stringify(response.headers)}`)
            instance.log('info', `Response body: ${response.data}`)
            
            if (response.statusCode === 200) {
                instance.log('info', `Matrix request successful: ${outputId} -> ${inputId}`)
                return true
            } else {
                instance.log('error', `Matrix request failed with status ${response.statusCode}`)
                return false
            }
        } catch (error) {
            instance.log('error', 'Matrix request error: ' + error.message)
            return false
        }
    },

    async disableMatrixOutput(instance, outputId) {
        instance.log('info', `Disabling matrix output: ${outputId}`)
        if (!instance.authHeader || !instance.csrfToken) {
            instance.log('info', 'Auth header or CSRF token missing, re-authenticating')
            if (!(await instance.authenticate())) {
                instance.log('error', 'Re-authentication failed')
                return false
            }
        }

        const body = `<updateRuntime><base><output id="${outputId}"></output></base></updateRuntime>`

        // Generate a new authorization header specifically for this request
        const newAuthHeader = auth.digestAuth('POST', '/api/matrix', instance.realm, instance.nonce, instance.config.username, instance.config.password, instance.ncCounter++)

        const options = {
            hostname: instance.config.host,
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
                'Host': `${instance.config.host}:8080`,
                'Origin': `http://${instance.config.host}:8080`,
                'Referer': `http://${instance.config.host}:8080/assets/base/home.html`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
                'X-CSRF-Token': instance.csrfToken,
                'X-Requested-With': 'XMLHttpRequest',
                'Authorization': newAuthHeader
            }
        }

        instance.log('info', `Sending disable matrix request to ${options.hostname}:${options.port}`)
        instance.log('info', `Request headers: ${JSON.stringify(options.headers)}`)
        instance.log('info', `Request body: ${body}`)

        try {
            const response = await makeRequest(options, body)
            instance.log('info', `Disable matrix response status: ${response.statusCode}`)
            instance.log('info', `Response headers: ${JSON.stringify(response.headers)}`)
            instance.log('info', `Response body: ${response.data}`)
            
            if (response.statusCode === 200) {
                instance.log('info', `Matrix output disabled successfully: ${outputId}`)
                return true
            } else {
                instance.log('error', `Failed to disable matrix output with status ${response.statusCode}`)
                return false
            }
        } catch (error) {
            instance.log('error', 'Disable matrix request error: ' + error.message)
            return false
        }
    }
}