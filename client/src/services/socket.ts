import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/events'

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>

export const socket: AppSocket = io()

let registerRole: (() => void) | null = null

/**
 * Each view declares how to (re-)announce itself to the server.
 * Re-invoked on every reconnect so the server can restore this client's role.
 */
export function setRegisterRole(fn: (() => void) | null): void {
  registerRole = fn
  if (fn && socket.connected) fn()
}

socket.on('connect', () => registerRole?.())
