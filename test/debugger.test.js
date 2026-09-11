'use strict';

const { test, assertEqual } = require('./harness');
const vscodeMock = require('./vscode-mock');
const { DebuggerTracker } = require('../out/debugger/DebuggerTracker');

console.log('\nBODHA DebuggerTracker Tests (Real Module)');

test('DebuggerTracker.register registers tracker factory', () => {
  let registeredType = null;
  let trackerFactory = null;
  const originalRegister = vscodeMock.debug.registerDebugAdapterTrackerFactory;
  vscodeMock.debug.registerDebugAdapterTrackerFactory = (type, factory) => {
    registeredType = type;
    trackerFactory = factory;
    return { dispose: () => {} };
  };

  const context = { subscriptions: [] };
  DebuggerTracker.register(context, () => {});

  assertEqual(registeredType, '*');
  assertEqual(typeof trackerFactory.createDebugAdapterTracker, 'function');
  vscodeMock.debug.registerDebugAdapterTrackerFactory = originalRegister;
});

test('DebuggerTracker.captureSessionState extracts frames, scopes, and variables', async () => {
  let callbackInvoked = false;
  let capturedSessionName = '';

  const context = { subscriptions: [] };
  DebuggerTracker.register(context, (sessionName, frames) => {
    callbackInvoked = true;
    capturedSessionName = sessionName;
  });

  const mockSession = {
    name: 'GDB Launch Test',
    customRequest: async (command, args) => {
      if (command === 'stackTrace') {
        return {
          stackFrames: [
            {
              id: 1,
              name: 'calculateSum',
              line: 42,
              column: 8,
              source: { path: '/workspace/math.c' }
            }
          ]
        };
      }
      if (command === 'scopes') {
        return {
          scopes: [{ name: 'Locals', variablesReference: 1001 }]
        };
      }
      if (command === 'variables') {
        return {
          variables: [
            { name: 'total', value: '150', type: 'int' },
            { name: 'multiplier', value: '2.5', type: 'double' }
          ]
        };
      }
      return null;
    }
  };

  const frames = await DebuggerTracker.captureSessionState(mockSession);
  assertEqual(frames.length, 1);
  assertEqual(frames[0].name, 'calculateSum');
  assertEqual(frames[0].line, 42);
  assertEqual(frames[0].source, 'math.c');
  assertEqual(frames[0].variables.length, 2);
  assertEqual(frames[0].variables[0].name, 'total');
  assertEqual(frames[0].variables[0].value, '150');
  assertEqual(frames[0].variables[1].type, 'double');

  assertEqual(callbackInvoked, true);
  assertEqual(capturedSessionName, 'GDB Launch Test');

  const activeFrames = DebuggerTracker.getActiveFrames();
  assertEqual(activeFrames.length, 1);
  assertEqual(activeFrames[0].name, 'calculateSum');
});

test('DebuggerTracker.captureSessionState handles unsupported customRequest gracefully', async () => {
  const failingSession = {
    name: 'Failing Debug Session',
    customRequest: async () => {
      throw new Error('DAP request failed');
    }
  };

  const frames = await DebuggerTracker.captureSessionState(failingSession);
  assertEqual(Array.isArray(frames), true);
  assertEqual(frames.length, 0);
});

console.log('DebuggerTracker tests completed.');
