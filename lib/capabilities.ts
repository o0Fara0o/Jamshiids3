/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export const modelCapabilities: Record<string, {
  search: boolean;
  urlContext: boolean;
  functionCalling: boolean;
}> = {
  'gemini-2.5-flash-native-audio-preview-09-2025': {
    search: true,
    urlContext: false,
    functionCalling: false,
  },
  'gemini-2.0-flash': {
    search: true,
    urlContext: false,
    functionCalling: true,
  }
};
