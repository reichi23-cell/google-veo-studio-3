/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

export default function APIKeyModal({ isOpen }: { isOpen: boolean, onClose: () => void, currentKey: string, onSave: (k: string) => void }) {
  if (!isOpen) return null;
  return null; // Platform handles this
}
