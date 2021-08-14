export class PathVariablesPattern {
  private readonly re: RegExp
  constructor(s: string) {
    this.re = compilePathVariablesPatternToRegexp(s)
  }

  match(path: string): Map<string, string> {
    const m = this.re.exec(path)
    if (m?.groups === undefined) {
      return new Map<string, string>()
    }
    const variables = new Map<string, string>()
    for (const k of Object.keys(m.groups)) {
      const v = m.groups[k]
      variables.set(k, v)
    }
    return variables
  }
}

const compilePathVariablesPatternToRegexp = (s: string): RegExp => {
  const elements = s.split('/').map((e) => {
    if (e.startsWith('${') && e.endsWith('}')) {
      return `(?<${e.substring(2, e.length - 1)}>[^/]+?)`
    }
    if (e === '*') {
      return `[^/]+?`
    }
    if (e === '**') {
      return `.+?`
    }
    return escapeRegExp(e)
  })
  return new RegExp(`^${elements.join('/')}$`)
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#escaping
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // $& means the whole matched string
