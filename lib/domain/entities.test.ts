/**
 * Unit tests for entity-hierarchy domain (Portfolio/Program/Project, buildHierarchyNodes, buildHierarchyTree).
 * Spec: .kiro/specs/entity-hierarchy/ Target: 80%+ coverage.
 */

import {
  buildHierarchyNodes,
  buildHierarchyTree,
  type Portfolio,
  type Program,
  type Project,
  type HierarchyNode,
} from './entities'

const portfolio1: Portfolio = {
  id: 'pf1',
  name: 'Portfolio A',
  organization_id: 'org1',
  path: 'pf1',
}
const portfolio2: Portfolio = {
  id: 'pf2',
  name: 'Portfolio B',
  organization_id: 'org1',
  path: 'pf2',
}

const program1: Program = {
  id: 'pr1',
  portfolio_id: 'pf1',
  name: 'Program X',
  path: 'pf1.pr1',
}
const program2: Program = {
  id: 'pr2',
  portfolio_id: 'pf1',
  name: 'Program Y',
  path: 'pf1.pr2',
}

const project1: Project = {
  id: 'pj1',
  portfolio_id: 'pf1',
  program_id: 'pr1',
  name: 'Project Alpha',
  path: 'pf1.pr1.pj1',
}
const project2: Project = {
  id: 'pj2',
  portfolio_id: 'pf1',
  program_id: 'pr1',
  name: 'Project Beta',
  path: 'pf1.pr1.pj2',
}
const projectUngrouped: Project = {
  id: 'pj3',
  portfolio_id: 'pf1',
  program_id: null,
  name: 'Ungrouped Project',
  path: 'pf1.pj3',
}
const projectInProgram2: Project = {
  id: 'pj4',
  portfolio_id: 'pf1',
  program_id: 'pr2',
  name: 'Project Gamma',
  path: 'pf1.pr2.pj4',
}

describe('buildHierarchyNodes', () => {
  it('returns empty array when no portfolios', () => {
    const nodes = buildHierarchyNodes([], {}, {})
    expect(nodes).toEqual([])
  })

  it('returns one portfolio node when only portfolio given', () => {
    const nodes = buildHierarchyNodes([portfolio1], {}, {})
    expect(nodes).toHaveLength(1)
    expect(nodes[0].id).toBe('portfolio-pf1')
    expect(nodes[0].type).toBe('portfolio')
    expect(nodes[0].label).toBe('Portfolio A')
    expect(nodes[0].entity).toEqual(portfolio1)
    expect(nodes[0].parentId).toBeNull()
    expect(nodes[0].children).toEqual([])
  })

  it('adds programs under portfolio with correct parentId', () => {
    const programsByPortfolio: Record<string, Program[]> = { pf1: [program1, program2] }
    const nodes = buildHierarchyNodes([portfolio1], programsByPortfolio, {})
    const portfolioNode = nodes.find((n) => n.type === 'portfolio')
    const programNodes = nodes.filter((n) => n.type === 'program')
    expect(programNodes).toHaveLength(2)
    expect(programNodes.every((n) => n.parentId === 'portfolio-pf1')).toBe(true)
    expect(programNodes.map((n) => n.label)).toEqual(['Program X', 'Program Y'])
  })

  it('adds projects under program and ungrouped under portfolio', () => {
    const programsByPortfolio: Record<string, Program[]> = { pf1: [program1, program2] }
    const projectsByPortfolio: Record<string, Project[]> = {
      pf1: [project1, project2, projectUngrouped, projectInProgram2],
    }
    const nodes = buildHierarchyNodes([portfolio1], programsByPortfolio, projectsByPortfolio)
    const portfolioNode = nodes.find((n) => n.id === 'portfolio-pf1')
    const programX = nodes.find((n) => n.id === 'program-pr1')
    const programY = nodes.find((n) => n.id === 'program-pr2')
    const projectNodes = nodes.filter((n) => n.type === 'project')
    expect(projectNodes).toHaveLength(4)
    expect(nodes.find((n) => n.id === 'project-pj1')?.parentId).toBe('program-pr1')
    expect(nodes.find((n) => n.id === 'project-pj2')?.parentId).toBe('program-pr1')
    expect(nodes.find((n) => n.id === 'project-pj4')?.parentId).toBe('program-pr2')
    expect(nodes.find((n) => n.id === 'project-pj3')?.parentId).toBe('portfolio-pf1')
  })

  it('handles missing programsByPortfolio key for portfolio', () => {
    const nodes = buildHierarchyNodes([portfolio1], {}, { pf1: [projectUngrouped] })
    const projectNode = nodes.find((n) => n.id === 'project-pj3')
    expect(projectNode).toBeDefined()
    expect(projectNode?.parentId).toBe('portfolio-pf1')
  })

  it('handles multiple portfolios with correct grouping', () => {
    const programsByPortfolio: Record<string, Program[]> = { pf1: [program1], pf2: [] }
    const projectsByPortfolio: Record<string, Project[]> = { pf1: [project1], pf2: [] }
    const nodes = buildHierarchyNodes(
      [portfolio1, portfolio2],
      programsByPortfolio,
      projectsByPortfolio
    )
    expect(nodes.some((n) => n.id === 'portfolio-pf1')).toBe(true)
    expect(nodes.some((n) => n.id === 'portfolio-pf2')).toBe(true)
    expect(nodes.find((n) => n.id === 'project-pj1')?.parentId).toBe('program-pr1')
  })
})

describe('buildHierarchyTree', () => {
  it('returns empty array when no portfolios', () => {
    const tree = buildHierarchyTree([], {}, {})
    expect(tree).toEqual([])
  })

  it('returns single root with no children when only portfolio', () => {
    const tree = buildHierarchyTree([portfolio1], {}, {})
    expect(tree).toHaveLength(1)
    expect(tree[0].children).toEqual([])
  })

  it('builds nested tree: portfolio -> programs -> projects', () => {
    const programsByPortfolio: Record<string, Program[]> = { pf1: [program1] }
    const projectsByPortfolio: Record<string, Project[]> = { pf1: [project1, projectUngrouped] }
    const tree = buildHierarchyTree([portfolio1], programsByPortfolio, projectsByPortfolio)
    expect(tree).toHaveLength(1)
    const root = tree[0]
    expect(root.type).toBe('portfolio')
    expect(root.children).toHaveLength(2) // one program + ungrouped project under portfolio
    const programChild = root.children.find((c) => c.type === 'program')
    const ungroupedChild = root.children.find((c) => c.id === 'project-pj3')
    expect(programChild).toBeDefined()
    expect(programChild!.children).toHaveLength(1)
    expect(programChild!.children[0].id).toBe('project-pj1')
    expect(ungroupedChild).toBeDefined()
  })

  it('tree node ids and parentIds are consistent', () => {
    const programsByPortfolio: Record<string, Program[]> = { pf1: [program1] }
    const projectsByPortfolio: Record<string, Project[]> = { pf1: [project1] }
    const tree = buildHierarchyTree([portfolio1], programsByPortfolio, projectsByPortfolio)
    const allNodes: HierarchyNode[] = []
    function collect(node: HierarchyNode) {
      allNodes.push(node)
      node.children.forEach(collect)
    }
    tree.forEach(collect)
    for (const n of allNodes) {
      if (n.parentId) {
        const parent = allNodes.find((x) => x.id === n.parentId)
        expect(parent).toBeDefined()
      }
    }
  })
})
