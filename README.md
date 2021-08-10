# pino-slack-transport
[![npm version](https://img.shields.io/npm/v/pino-slack-transport)](https://www.npmjs.com/package/pino-slack-transport)
[![npm downloads](https://img.shields.io/npm/dm/pino-slack-transport.svg)](https://www.npmjs.com/package/pino-slack-transport)
[![Known Vulnerabilities](https://snyk.io/test/github/chrislahaye/pino-slack-transport/badge.svg)](https://snyk.io/test/github/chrislahaye/pino-slack-transport)

## Install

```ts
yarn install pino-slack-transport
```

## Usage

### *lib/logger.mjs*

```js
import { createTransport } from 'pino-slack-transport'

// with options defined in pino
export default createTransport

// with options defined in this module
const options = { webhookUrl: 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX' }

export default function transport() {
  return createTransport(options)
}
```

### *src/logger.ts*

```ts
import { createTransport } from 'pino-slack-transport'
import { pino } from 'pino'

const options = { webhookUrl: 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX' }

const logger = pino(
  pino.transport({
    targets: [
      // { level: 'error', target: '#pino/file', options: { destination: '/dev/stderr' } },
      // { level: 'trace', target: '#pino/file', options: { destination: '/dev/stdout' } },
      { level: 'debug', target: '../lib/logger.mjs', options }
    ]
  })
)
```

## Options

### `channelKey`

The string key for the 'channel' in the JSON object.

By default, the channel inherits from the associated Slack app configuration.

### `colors`

Default: `{ 30: '#2EB67D', 40: '#ECB22E', 50: '#E01E5A', 60: '#E01E5A' }`

The mapping from level to color.

### `excludedKeys`

Default: `{ hostname: 0, pid: 0 }`

The string keys excluded from the JSON object.

### `keepAlive`

Keep sockets around so they can be used for future requests without having to reestablish a TCP connection.

### `messageKey`

Default: `'msg'`

The string key for the 'message' in the JSON object.

### `webhookUrl` (required)

The Incoming Webhook URL.
