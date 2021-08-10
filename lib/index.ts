import { Writable } from 'stream'
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

interface Args {
  agent?: https.Agent
  log: string
  options: Options
}
const process = async ({
  agent,
  log,
  options: {
    channelKey,
    colors = DEFAULT_COLORS,
    excludedKeys = DEFAULT_EXCLUDED_KEYS,
    messageKey = DEFAULT_MESSAGE_KEY,
    webhookUrl
  }
}: Args): Promise<void> => {
  const { [messageKey]: msg, time, level, ...bindings } = JSON.parse(log)

  const payload: any = {
    blocks: []
  }

  if (typeof channelKey === 'string') {
    payload.channel = bindings[channelKey]
  }

  if (typeof msg === 'string') {
    payload.text = msg
    payload.blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `\`\`\`${msg}\`\`\`` }
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

  if (fields.length > 0) {
    payload.attachments = [{
      color: colors[level],
      fields
    }]
  }

  await fetch(webhookUrl, {
    agent,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
}

export const createTransport = function (options: Options): Writable {
  const agent = options.keepAlive === true
    ? new https.Agent({ keepAlive: true })
    : undefined

  return new Writable({
    write (chunk, _enc, cb) {
      const logs = chunk.toString().split('\n\n')

      for (const log of logs) {
        // eslint-disable-next-line no-void
        void process({
          agent,
          log,
          options
        })
          .catch((reason) => console.error(reason))
          .then(() => cb())
      }
    }
  })
}

export default createTransport
