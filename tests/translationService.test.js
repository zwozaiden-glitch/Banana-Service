import test from 'node:test';
import assert from 'node:assert/strict';
import { TranslationService } from '../src/services/translationService.js';

test('Translation Tokenization & Code Preservation', async (t) => {
  await t.test('Protects code blocks, inline code, URLs, and Discord mentions', () => {
    const rawText = 'Check out this script ```lua\nprint("banana")\n``` and visit https://example.com or ping <@123456789012345678>!';
    const { processed, tokens } = TranslationService.tokenizeText(rawText);

    assert.ok(!processed.includes('```lua'));
    assert.ok(!processed.includes('https://example.com'));
    assert.ok(!processed.includes('<@123456789012345678>'));
    assert.ok(tokens.length >= 3);

    // Detokenize restores exact formatting
    const restored = TranslationService.detokenizeText(processed, tokens);
    assert.equal(restored, rawText);
  });
});
