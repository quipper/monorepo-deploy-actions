export const compilePathPatternsToRegexp = (patterns: string[]): RegExp[] => patterns.map(compilePathPatternToRegexp)

const compilePathPatternToRegexp = (s: string): RegExp => {
  const elements = s.split('/').map((e) => {
    if (e.startsWith(':')) {
      return `(?<${e.substring(1)}>[^/]+?)`
    }
    if (e === '*') {
      return `[^/]+?`
    }
    if (e === '**') {
      return `.+?`
    }
    return e
  })
  return new RegExp(`^${elements.join('/')}$`)
}

export const exec = (regexps: RegExp[], path: string): Map<string, string> => {
  const variables = new Map<string, string>()
  for (const re of regexps) {
    const m = re.exec(path)
    if (m?.groups !== undefined) {
      for (const k of Object.keys(m.groups)) {
        const v = m.groups[k]
        variables.set(k, v)
      }
    }
  }
  return variables
}
