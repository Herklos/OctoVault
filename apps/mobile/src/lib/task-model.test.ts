/**
 * task-model unit coverage — pure projection from ObjectNodes → board view.
 * No CRDT/transport needed: tasks are ObjectNodes in the union-merged index.
 */
import { describe, expect, it } from 'vitest';

import { tasksForBoard } from './task-model';
import type { Column } from './board-content';
import type { ObjectNode } from './types';

const BOARD_ID = 'board-1';

function col(id: string, title: string, done = false): Column {
  return { id, title, done };
}

function task(id: string, columnId: string, order: number, title = 'Task', status = 'todo', extra: Partial<ObjectNode> = {}): ObjectNode {
  return {
    id,
    type: 'task',
    title,
    parentId: BOARD_ID,
    archived: false,
    createdAt: 0,
    updatedAt: 0,
    props: { columnId, order, status },
    ...extra,
  } as ObjectNode;
}

describe('tasksForBoard', () => {
  it('groups tasks by column and sorts by order', () => {
    const cols = [col('todo', 'To do'), col('done', 'Done', true)];
    const nodes: ObjectNode[] = [
      task('t2', 'todo', 2, 'Second'),
      task('t1', 'todo', 1, 'First'),
    ];
    const { tasksByColumn } = tasksForBoard(nodes, BOARD_ID, cols);
    expect(tasksByColumn['todo']!.map((t) => t.title)).toEqual(['First', 'Second']);
  });

  it('excludes archived nodes', () => {
    const cols = [col('todo', 'To do')];
    const nodes: ObjectNode[] = [
      task('t1', 'todo', 1, 'Live'),
      task('t2', 'todo', 2, 'Gone', 'todo', { archived: true }),
    ];
    const { total } = tasksForBoard(nodes, BOARD_ID, cols);
    expect(total).toBe(1);
  });

  it('excludes nodes from other boards', () => {
    const cols = [col('todo', 'To do')];
    const nodes: ObjectNode[] = [
      task('t1', 'todo', 1, 'Mine'),
      { ...task('t2', 'todo', 2, 'Theirs'), parentId: 'other-board' },
    ];
    const { total } = tasksForBoard(nodes, BOARD_ID, cols);
    expect(total).toBe(1);
  });

  it('re-homes orphaned tasks (unknown columnId) to first column', () => {
    const cols = [col('todo', 'To do'), col('done', 'Done', true)];
    const nodes: ObjectNode[] = [
      task('t1', 'no-such-col', 1, 'Orphan'),
    ];
    const { tasksByColumn } = tasksForBoard(nodes, BOARD_ID, cols);
    expect(tasksByColumn['todo']!.some((t) => t.title === 'Orphan')).toBe(true);
  });

  it('derives done from column membership when a done column exists', () => {
    const cols = [col('todo', 'To do'), col('done', 'Done', true)];
    const nodes: ObjectNode[] = [
      task('t1', 'todo', 1, 'Open'),
      task('t2', 'done', 2, 'Closed'),
    ];
    const { tasksByColumn, done } = tasksForBoard(nodes, BOARD_ID, cols);
    expect(tasksByColumn['todo']![0]!.done).toBe(false);
    expect(tasksByColumn['done']![0]!.done).toBe(true);
    expect(done).toBe(1);
  });

  it('derives done from status register on boards without a done column', () => {
    const cols = [col('col', 'Stuff')];
    const nodes: ObjectNode[] = [
      task('t1', 'col', 1, 'Legacy done', 'done'),
      task('t2', 'col', 2, 'Still open', 'todo'),
    ];
    const { tasksByColumn, done } = tasksForBoard(nodes, BOARD_ID, cols);
    expect(tasksByColumn['col']![0]!.done).toBe(true);
    expect(tasksByColumn['col']![1]!.done).toBe(false);
    expect(done).toBe(1);
  });

  it('returns empty view when columns list is empty', () => {
    const nodes: ObjectNode[] = [task('t1', 'todo', 1)];
    const { tasksByColumn, done, total } = tasksForBoard(nodes, BOARD_ID, []);
    expect(tasksByColumn).toEqual({});
    expect(done).toBe(0);
    expect(total).toBe(0);
  });
});
