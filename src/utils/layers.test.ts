import test from 'node:test';
import assert from 'node:assert/strict';
import { CanvasLayer } from '../types';

function moveLayer(
  layers: CanvasLayer[],
  index: number,
  direction: 'up' | 'down' | 'top' | 'bottom'
): CanvasLayer[] {
  const updated = [...layers];
  const item = updated[index];

  if (direction === 'up' && index > 0) {
    updated[index] = updated[index - 1];
    updated[index - 1] = item;
  } else if (direction === 'down' && index < updated.length - 1) {
    updated[index] = updated[index + 1];
    updated[index + 1] = item;
  } else if (direction === 'top' && index > 0) {
    updated.splice(index, 1);
    updated.unshift(item);
  } else if (direction === 'bottom' && index < updated.length - 1) {
    updated.splice(index, 1);
    updated.push(item);
  }

  return updated;
}

function sendHeadlineBehindProduct(layers: CanvasLayer[]): CanvasLayer[] {
  const typoIndex = layers.findIndex((l) => l.type === 'typography');
  const prodIndex = layers.findIndex((l) => l.type === 'product');
  if (typoIndex !== -1 && prodIndex !== -1 && typoIndex < prodIndex) {
    const updated = [...layers];
    const typo = updated.splice(typoIndex, 1)[0];
    const newProdIndex = updated.findIndex((l) => l.type === 'product');
    updated.splice(newProdIndex + 1, 0, typo);
    return updated;
  }
  return layers;
}

function bringProductToFront(layers: CanvasLayer[]): CanvasLayer[] {
  const prodIndex = layers.findIndex((l) => l.type === 'product');
  if (prodIndex > 0) {
    const updated = [...layers];
    const prod = updated.splice(prodIndex, 1)[0];
    updated.unshift(prod);
    return updated;
  }
  return layers;
}

test('moveLayer moves item up and down properly', () => {
  const initial: CanvasLayer[] = [
    { id: '1', name: 'Layer 1', type: 'promoBadge', visible: true, locked: false },
    { id: '2', name: 'Layer 2', type: 'product', visible: true, locked: false },
    { id: '3', name: 'Layer 3', type: 'typography', visible: true, locked: false },
  ];

  // Move product up to index 0
  const afterUp = moveLayer(initial, 1, 'up');
  assert.equal(afterUp[0].id, '2');
  assert.equal(afterUp[1].id, '1');

  // Move product to bottom
  const afterBottom = moveLayer(initial, 1, 'bottom');
  assert.equal(afterBottom[2].id, '2');
});

test('sendHeadlineBehindProduct positions typography after product', () => {
  const initial: CanvasLayer[] = [
    { id: 'typo', name: 'Headline', type: 'typography', visible: true, locked: false },
    { id: 'prod', name: 'Product', type: 'product', visible: true, locked: false },
  ];

  const result = sendHeadlineBehindProduct(initial);
  assert.equal(result[0].id, 'prod');
  assert.equal(result[1].id, 'typo');
});

test('bringProductToFront puts product at index 0 (topmost z-index)', () => {
  const initial: CanvasLayer[] = [
    { id: 'promo', name: 'Promo', type: 'promoBadge', visible: true, locked: false },
    { id: 'prod', name: 'Product', type: 'product', visible: true, locked: false },
    { id: 'typo', name: 'Headline', type: 'typography', visible: true, locked: false },
  ];

  const result = bringProductToFront(initial);
  assert.equal(result[0].id, 'prod');
});
