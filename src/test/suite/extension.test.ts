import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../../extension';

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.');

  test('Sample test', () => {
    assert.strictEqual([1, 2, 3].indexOf(5), -1);
    assert.strictEqual([1, 2, 3].indexOf(0), -1);
    assert.strictEqual([1, 2, 3].indexOf(2), 1);
  });

  test("Sample test 2 which should fail", () => {
    assert.strictEqual([1, 2, 3].indexOf(4), 3);
  });

  test("Sample test 3 which should pass", () => {
    assert.strictEqual([1, 2, 3].indexOf(3), 2);
  });
});
