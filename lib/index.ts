import { Writable } from 'stream'
import * as build from 'pino-abstract-transport'
import * as https from 'https'
import fetch from 'node-fetch'

export interface Options {
  /**
   * The string key for the 'channel' in the JSON object.
   *
   * By default, the channel inherits from the associated Slack app configuration.
   */
  channelKey?: string

  /**
   * The mapping from level to color.
   *
   * @defaultValue `{ 30: '#2EB67D', 40: '#ECB22E', 50: '#E01E5A', 60: '#E01E5A' }`
   */
  colors?: Record<number | string, string>

  /**
   * The string keys excluded from the JSON object.
   *
   * @defaultValue `{ hostname: 0, pid: 0 }`
   */
  excludedKeys?: Record<string, any>

  /**
   * The string key for the image URL in the JSON object.
   */
  imageUrlKey?: string

  /**
   * Keep sockets around so they can be used for future requests without having to reestablish a TCP connection.
   */
  keepAlive?: boolean

  /**
   * The string key for the 'message' in the JSON object.
   *
   * @defaultValue `'msg'`
   */
  messageKey?: string

  /**
   * The Incoming Webhook URL.
   */
  webhookUrl: string
}

interface Args {
  agent?: https.Agent
  log: Record<string, any>
  options: Options
}

const DEFAULT_COLORS = { 30: '#2EB67D', 40: '#ECB22E', 50: '#E01E5A', 60: '#E01E5A' }
const DEFAULT_EXCLUDED_KEYS = { hostname: 0, pid: 0 }
const DEFAULT_MESSAGE_KEY = 'msg'

const flatten = (
  obj: Record<string, unknown>,
  keys: string[] = []
): Record<string, string> => {
  return Object.entries(obj).reduce((acc, [key, value]) => ({
    ...acc,
    ...value !== null && typeof value === 'object' ? flatten(value as Record<string, unknown>, keys.concat(key)) : { [keys.concat(key).join('.')]: String(value) }
  }), {})
}

const process = async ({
  agent,
  log,
  options: {
    channelKey,
    colors = DEFAULT_COLORS,
    excludedKeys = DEFAULT_EXCLUDED_KEYS,
    imageUrlKey,
    messageKey = DEFAULT_MESSAGE_KEY,
    webhookUrl
  }
}: Args): Promise<void> => {
  const { [messageKey]: msg, time, level, ...bindings } = log

  const payload: any = {
    blocks: []
  }

  if (typeof channelKey === 'string') {
    payload.channel = bindings[channelKey]
  }

  if (typeof msg === 'string') {
    const text = msg.length <= 2500? msg : `${msg.substring(0, 2500)}...`;
    payload.text = text
    payload.blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `\`\`\`${text}\`\`\`` }
    })
  }

  const date = new Date(time)

  payload.blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: `<!date^${Math.floor(date.getTime() / 1000)}^Posted {date_pretty} at {time_secs}|Posted ${date.toString()}>` }]
  })

  const data = Object.keys(bindings).reduce((acc, key) => ({ ...acc, ...key in excludedKeys ? {} : { [key]: bindings[key] } }), {})
  const fields = Object.entries(flatten(data)).map(([title, value]) => ({
    title,
    value,
    short: value.length < 500
  }))
  const imageUrl = typeof imageUrlKey === 'string' ? bindings[imageUrlKey] : undefined

  if (fields.length > 0 || typeof imageUrl === 'string') {
    payload.attachments = [{
      color: colors[level],
      fields,
      image_url: imageUrl
    }]
  }

  await fetch(webhookUrl, {
    agent,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
}

export const createTransport = (options: Options): Writable => {
  const agent = options.keepAlive === true
    ? new https.Agent({ keepAlive: true })
    : undefined

  return build(async (iterable: Iterable<Record<string, any>>) => {
    for await (const log of iterable) {
      try {
        await process({
          agent,
          log,
          options
        })
      } catch (err) {
        console.error(err)
      }
    }
  })
}

export default createTransport
