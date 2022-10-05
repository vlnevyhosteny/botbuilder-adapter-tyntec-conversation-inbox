import {
  Activity,
  BotAdapter,
  ConversationReference,
  ResourceResponse,
  TurnContext,
} from 'botbuilder'
import { ApiClient, OpenAPIConfig, SendMessageResponse } from './api'
import { SendTextMessageBodyType } from './api/generated/models/SendTextMessageBodyType'

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
}
