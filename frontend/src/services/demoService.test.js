import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateScore, createMockQuestions, formatFileSize } from './demoService.js';

test('calculates quiz scores from exact answer sets', () => {
  const questions = [
    { id: 'one', options: ['A', 'B'], correctIndex: 1 },
    { id: 'two', options: ['A', 'B', 'C'], correctAnswers: ['A', 'C'] },
    { id: 'three', options: ['True', 'False'], correctAnswers: ['True'] },
  ];

  assert.equal(calculateScore(questions, {
    one: ['B'],
    two: ['C', 'A'],
    three: ['False'],
  }), 67);
});

test('creates the requested number of questions with configured option counts', () => {
  const questions = createMockQuestions(15, 'Hard', ['Multiple Choice', 'True / False'], 3);

  assert.equal(questions.length, 15);
  assert.equal(questions[0].difficulty, 'Hard');
  assert.equal(questions[0].options.length, 3);
  assert.deepEqual(questions[1].options, ['True', 'False']);
  assert.ok(questions.every((question) => question.correctAnswers.length > 0));
});

test('formats uploaded file sizes for the document library', () => {
  assert.equal(formatFileSize(512), '1 KB');
  assert.equal(formatFileSize(1_572_864), '1.5 MB');
});
