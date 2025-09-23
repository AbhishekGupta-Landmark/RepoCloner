import { setupServer } from 'msw/node'
import { nodeHandlers } from './node-handlers'

export const server = setupServer(...nodeHandlers)