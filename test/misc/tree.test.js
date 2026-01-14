import { expect, test } from 'vitest'
import { bfs, descendants } from '../../src/utils/tree.js'

const root = {
  name: 'root',
  children: [
    { name: 'left' },
    {
      name: 'right',
      children: [{ name: 'right-left' }, { name: 'right-right' }]
    }
  ]
}

test('bfs visits nodes in breadth-first order', () => {
  const visited = []
  bfs(root, (node) => visited.push(node.name))
  expect(visited).toEqual(['root', 'right', 'right-right', 'right-left', 'left'])
})

test('descendants collects every node including root', () => {
  const nodes = descendants(root)
  expect(nodes.length).toBe(5)
  expect(nodes.map((d) => d.name)).toEqual(
    expect.arrayContaining(['root', 'left', 'right-left'])
  )
})
