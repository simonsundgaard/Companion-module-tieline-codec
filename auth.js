const crypto = require('crypto')
const { makeRequest } = require('./api')

module.exports = {
    md5(data) {
        return crypto.createHash('md5').update(data).digest('hex')
    },

    digestAuth(method, uri, realm, nonce, username, password, ncCounter) {
        const ha1 = this.md5(`${username}:${realm}:${password}`)
        const ha2 = this.md5(`${method}:${uri}`)
        const cnonce = crypto.randomBytes(8).toString('hex')
        const nc = ('0000000' + ncCounter).slice(-8)
        const qop = 'auth'
        
        const response = this.md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
        
        return `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", algorithm="MD5", qop=${qop}, nc=${nc}, cnonce="${cnonce}", response="${response}"`
    },

    async authenticate(instance) {
        instance.log('info', 'Starting authentication process')
        const options = {
            hostname: instance.config.host,
            port: 8080,
            path: '/assets/base/home.html',
            method: 'GET',
            headers: {
                'User-Agent': 'Companion-Module',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            }
        }

        try {
            instance.log('info', `Sending initial request to ${options.hostname}`)
            const response = await makeRequest(options)
            instance.log('info', `Initial response status: ${response.statusCode}`)
            
            if (response.statusCode === 401 && response.headers['www-authenticate']) {
                const wwwAuthHeader = response.headers['www-authenticate']
                const realm = wwwAuthHeader.match(/realm="([^"]+)"/)[1]
                const nonce = wwwAuthHeader.match(/nonce="([^"]+)"/)[1]
                
                const authHeader = this.digestAuth('GET', '/assets/base/home.html', realm, nonce, instance.config.username, instance.config.password, instance.ncCounter++)
                options.headers['Authorization'] = authHeader

                instance.log('info', 'Sending authenticated request')
                const authenticatedResponse = await makeRequest(options)
                instance.log('info', `Authenticated response status: ${authenticatedResponse.statusCode}`)

                if (authenticatedResponse.statusCode === 200) {
                    instance.log('info', 'Authentication successful')
                    let csrfToken = null
                    if (authenticatedResponse.headers['set-cookie']) {
                        const csrfCookie = authenticatedResponse.headers['set-cookie'].find(cookie => cookie.startsWith('csrfCookie='))
                        if (csrfCookie) {
                            csrfToken = csrfCookie.split(';')[0].split('=')[1]
                        }
                    }
                    return { authHeader, csrfToken, realm, nonce }
                } else {
                    instance.log('error', 'Authentication failed')
                    return null
                }
            }
        } catch (error) {
            instance.log('error', 'Authentication error: ' + error.message)
            return null
        }
    }
}