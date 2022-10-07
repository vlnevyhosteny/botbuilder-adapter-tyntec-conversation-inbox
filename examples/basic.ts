import express from 'express'

import { TyntecConversationInboxAdapter } from '../src/TyntecConversationInboxAdapter'

const adapter = new TyntecConversationInboxAdapter({
  wabaNumber: 123,
  TOKEN: 'asda',
})

const app = express()

app.post('/incoming', (req, res) => {
  adapter.processIncomingMessage(req, res, () =>
    Promise.resolve('Do something'),
  )
})

app.listen(3000)
