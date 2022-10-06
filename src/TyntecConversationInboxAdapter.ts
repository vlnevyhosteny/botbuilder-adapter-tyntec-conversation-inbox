import {
  Activity,
  ActivityTypes,
  BotAdapter,
  ConversationReference,
  ResourceResponse,
  TurnContext,
  WebRequest,
  WebResponse,
} from 'botbuilder'
import { ApiClient, OpenAPIConfig, SendMessageResponse } from './api'
import { InboundMessage } from './api/generated/models/InboundMessage'
import { SendTextMessageBodyType } from './api/generated/models/SendTextMessageBodyType'
import Ajv from 'ajv'
import { $InboundMessage } from './api/generated/schemas/$InboundMessage'
import { inboundMessageToActivity } from './ActivityHelper'
import { ValidationError } from './errors'

export interface TyntecConversationInboxAdapterConfig
  extends Pick<OpenAPIConfig, 'TOKEN'> {
  wabaNumber: number
}

export class TyntecConversationInboxAdapter extends BotAdapter {
  private readonly apiClient: ApiClient = <any>{}

  private readonly whatsAppChannelJid: string

  constructor(config: TyntecConversationInboxAdapterConfig) {
    super()

    this.apiClient = new ApiClient(config)
    this.whatsAppChannelJid = this.composeWhatsAppChannelJid(config)
  }

  public sendMessage = async (
    channelJid: string,
    contactJid: string,
    requestBody: SendTextMessageBodyType,
  ): Promise<SendMessageResponse> =>
    this.apiClient.messaging.sendMessage({
      channelJid,
      contactJid,
      requestBody,
    })

  public sendMessageToWhatsApp = async (
    contactJid: string,
    requestBody: SendTextMessageBodyType,
  ) => this.sendMessage(this.whatsAppChannelJid, contactJid, requestBody)

  public async sendActivities(
    _context: TurnContext,
    activities: Partial<Activity>[],
  ): Promise<ResourceResponse[]> {
    const promises = activities
      .filter((activity) => activity.conversation && activity.text)
      .map((activity) =>
        // TODO: hardcoded channel
        this.sendMessageToWhatsApp(activity.conversation!.id, {
          type: 'text',
          body: activity.text!,
        }),
      )

    return Promise.all(promises)
  }

  public continueConversation(
    reference: Partial<ConversationReference>,
    logic: (revocableContext: TurnContext) => Promise<void>,
  ): Promise<void> {
    const activity = TurnContext.applyConversationReference(
      { type: 'event', name: 'continueConversation' },
      reference,
      true,
    )

    const context = new TurnContext(this, activity)
    return this.runMiddleware(context, logic)
  }

  public async processIncomingMessage(
    req: WebRequest,
    res: WebResponse,
    logic: (context: TurnContext) => Promise<any>,
  ): Promise<void> {
    if (!this.validateIncomingMessage(req.body)) {
      res.status(400)
      res.send('Invalid incoming message')
      res.end()
    }
    const message = req.body as InboundMessage

    try {
      const context = new TurnContext(this, inboundMessageToActivity(message))
      await this.runMiddleware(context, logic)

      res.status(200)
      res.end()
    } catch (e) {
      if (e instanceof ValidationError) {
        res.status(400)
        res.send(`${e.name}: ${e.message}`)
        res.end()
      }

      res.status(500)
      res.send(`Failed to process incoming message: ${e}`)
      res.end()
    }
  }

  public updateActivity(
    _context: TurnContext,
    _activity: Partial<Activity>,
  ): Promise<void | ResourceResponse> {
    throw new Error('Method not implemented.')
  }

  public deleteActivity(
    _context: TurnContext,
    _reference: Partial<ConversationReference>,
  ): Promise<void> {
    throw new Error('Method not implemented.')
  }

  protected composeWhatsAppChannelJid = (
    params: Pick<TyntecConversationInboxAdapterConfig, 'wabaNumber'>,
  ) => `${params.wabaNumber}@whatsapp.eazy.im`

  private validateIncomingMessage(incoming?: any): incoming is InboundMessage {
    if (!incoming) {
      return false
    }

    const validator = new Ajv()
    const validate = validator.compile($InboundMessage)

    return validate(incoming)
  }
}
