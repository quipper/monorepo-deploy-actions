import * as yaml from 'js-yaml'

export type Application = {
  name: string
  project: string
  source: {
    repository: string
    branch: string
    path: string
  }
  destination: {
    namespace: string
  }
  annotations: string[]
}

type KubernetesApplication = {
  apiVersion: string
  kind: string
  metadata: {
    name: string
    namespace: string
    annotations?: { [key: string]: string }
    finalizers: string[]
  }
  spec: {
    project: string
    source: {
      repoURL: string
      targetRevision: string
      path: string
    }
    destination: {
      server: string
      namespace: string
    }
    syncPolicy: {
      automated: {
        prune: boolean
      }
    }
  }
}

export const generateApplicationManifest = (a: Application): string => {
  const application: KubernetesApplication = {
    apiVersion: 'argoproj.io/v1alpha1',
    kind: 'Application',
    metadata: {
      name: a.name,
      namespace: 'argocd',
      finalizers: ['resources-finalizer.argocd.argoproj.io'],
    },
    spec: {
      project: a.project,
      source: {
        repoURL: `https://github.com/${a.source.repository}.git`,
        targetRevision: a.source.branch,
        path: a.source.path,
      },
      destination: {
        server: `https://kubernetes.default.svc`,
        namespace: a.destination.namespace,
      },
      syncPolicy: {
        automated: {
          prune: true,
        },
      },
    },
  }
  if (a.annotations.length > 0) {
    const annotations: { [_: string]: string } = {}
    for (const s of a.annotations) {
      const k = s.substring(0, s.indexOf('='))
      const v = s.substring(s.indexOf('=') + 1)
      annotations[k] = v
    }
    application.metadata.annotations = annotations
  }
  return yaml.dump(application)
}
