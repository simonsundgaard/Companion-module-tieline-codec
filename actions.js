module.exports = function (self) {
    self.setActionDefinitions({
        matrix_action: {
            name: 'Turn on input channel in headphone matrix',
            options: [
                {
                    id: 'input',
                    type: 'number',
                    label: 'Input Channel',
                    default: 1,
                    min: 1,
                    max: 16,
                },
            ],
            callback: async (event) => {
                self.log('info', `Action triggered: Input ${event.options.input}`)
                const outputId = 'hpl'
                const inputId = `in${event.options.input}`
                self.log('info', `Calling makeMatrixRequest with ${outputId} and ${inputId}`)
                const result = await self.makeMatrixRequest(outputId, inputId)
                if (result) {
                    self.log('info', `Matrix updated successfully: ${outputId} -> ${inputId}`)
                } else {
                    self.log('warn', `Failed to update matrix: ${outputId} -> ${inputId}`)
                }
            },
        },
        disable_matrix_output: {
            name: 'Disable headphone matrix output',
            options: [],
            callback: async (event) => {
                self.log('info', 'Action triggered: Disable headphone matrix output')
                const outputId = 'hpl'
                self.log('info', `Calling disableMatrixOutput with ${outputId}`)
                const result = await self.disableMatrixOutput(outputId)
                if (result) {
                    self.log('info', `Matrix output disabled successfully: ${outputId}`)
                } else {
                    self.log('warn', `Failed to disable matrix output: ${outputId}`)
                }
            },
        },
    })
}