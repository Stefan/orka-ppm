import { costbookKeys } from '../costbook-keys'

describe('lib/costbook/costbook-keys', () => {
  it('all returns ["costbook"]', () => {
    expect(costbookKeys.all).toEqual(['costbook'])
  })

  it('projects returns costbook.projects', () => {
    expect(costbookKeys.projects()).toEqual(['costbook', 'projects'])
  })

  it('projectsWithFinancials returns costbook.projects.financials', () => {
    expect(costbookKeys.projectsWithFinancials()).toEqual(['costbook', 'projects', 'financials'])
  })

  it('project(id) returns costbook.projects.id', () => {
    expect(costbookKeys.project('p1')).toEqual(['costbook', 'projects', 'p1'])
  })

  it('commitments returns costbook.commitments', () => {
    expect(costbookKeys.commitments()).toEqual(['costbook', 'commitments'])
  })

  it('commitmentsByProject returns costbook.commitments.projectId', () => {
    expect(costbookKeys.commitmentsByProject('proj-1')).toEqual(['costbook', 'commitments', 'proj-1'])
  })

  it('actuals returns costbook.actuals', () => {
    expect(costbookKeys.actuals()).toEqual(['costbook', 'actuals'])
  })

  it('actualsByProject returns costbook.actuals.projectId', () => {
    expect(costbookKeys.actualsByProject('proj-2')).toEqual(['costbook', 'actuals', 'proj-2'])
  })

  it('transactions returns costbook.transactions with optional filters', () => {
    expect(costbookKeys.transactions()).toEqual(['costbook', 'transactions', undefined])
    expect(costbookKeys.transactions({ status: 'open' })).toEqual(['costbook', 'transactions', { status: 'open' }])
  })

  it('kpis(currency) returns costbook.kpis.currency', () => {
    expect(costbookKeys.kpis('EUR')).toEqual(['costbook', 'kpis', 'EUR'])
  })
})
