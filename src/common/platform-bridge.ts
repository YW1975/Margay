/**
 * @license
 * Copyright 2025 Margay
 * SPDX-License-Identifier: Apache-2.0
 *
 * Typed IPC bridge — replaces @office-ai/platform bridge module.
 * Implements the same subscribe/invoke request-response pattern over
 * a pluggable transport (Electron IPC, WebSocket, BroadcastChannel).
 *
 * Original concept from @office-ai/platform (MIT License).
 */

import EventEmitter from 'eventemitter3';

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

const emitter = new EventEmitter();
let currentEmit: (name: string, data: unknown) => void = () => {};

function uid(prefix: string): string {
  return prefix + Math.random().toString(16).slice(2, 10);
}

// ---------------------------------------------------------------------------
// Adapter — sets the transport layer (called once per process side)
// ---------------------------------------------------------------------------

export function adapter(config: { emit: (name: string, data: unknown) => void; on: (emitter: { emit: (name: string, data: unknown) => unknown }) => void }): void {
  currentEmit = config.emit;
  config.on(emitter);
}

// ---------------------------------------------------------------------------
// Low-level: subscribe / invoke (request-response over named channels)
// ---------------------------------------------------------------------------

function subscribe<Data = unknown, Result = unknown>(name: string, handler: (data: Data) => Promise<Result>): () => void {
  const channelName = 'subscribe-' + name;
  const fn = (payload: { id: string; data: Data }) => {
    void handler(payload.data).then((result) => {
      currentEmit('subscribe.callback-' + name + payload.id, result);
    });
  };
  emitter.on(channelName, fn);
  return () => emitter.off(channelName, fn);
}

function invoke<Data = unknown>(name: string, data?: unknown): Promise<Data> {
  const id = uid(name);
  return new Promise<Data>((resolve) => {
    currentEmit('subscribe-' + name, { id, data });
    const callbackChannel = 'subscribe.callback-' + name + id;
    const fn = (result: Data) => {
      resolve(result);
      emitter.off(callbackChannel, fn);
    };
    emitter.on(callbackChannel, fn);
  });
}

// ---------------------------------------------------------------------------
// High-level: buildProvider / buildEmitter
// ---------------------------------------------------------------------------

export function buildProvider<Data, Params = undefined>(
  key: string
): {
  provider: (handler: Params extends undefined ? () => Promise<Data> : (params: Params) => Promise<Data>) => void;
  invoke: Params extends undefined ? () => Promise<Data> : (params: Params) => Promise<Data>;
} {
  let unsub: () => void = () => {};
  return {
    provider(handler: (params: Params) => Promise<Data>) {
      unsub();
      unsub = subscribe<Params, Data>(key, handler);
    },
    invoke(params?: Params) {
      return invoke<Data>(key, params);
    },
  } as any;
}

export function buildEmitter<Params = undefined>(
  key: string
): {
  on(callback: Params extends undefined ? () => void : (params: Params) => void): () => void;
  emit: Params extends undefined ? () => void : (params: Params) => void;
} {
  return {
    on(callback: (params: Params) => void): () => void {
      emitter.on(key, callback);
      return () => emitter.off(key, callback);
    },
    emit(params?: Params) {
      currentEmit(key, params);
    },
  } as any;
}

// ---------------------------------------------------------------------------
// Global on / off — direct event listeners
// ---------------------------------------------------------------------------

export function on(name: string, callback: (...args: any[]) => any): () => void {
  emitter.on(name, callback);
  return () => emitter.off(name, callback);
}

export function off(name: string, callback: (...args: any[]) => any): void {
  emitter.off(name, callback);
}
