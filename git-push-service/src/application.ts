import * as yaml from 'js-yaml'

type Application = {
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
}

type KubernetesApplication = {
  apiVersion: string
  kind: string
  metadata: {
    name: string
    namespace: string
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

export const generateApplicationManifest = (s: Application): string => {
  const application: KubernetesApplication = {
    apiVersion: 'argoproj.io/v1alpha1',
    kind: 'Application',
    metadata: {
      name: s.name,
      namespace: 'argocd',
      finalizers: ['resources-finalizer.argocd.argoproj.io'],
    },
    spec: {
      project: s.project,
      source: {
        repoURL: `https://github.com/${s.source.repository}.git`,
        targetRevision: s.source.branch,
        path: s.source.path,
      },
      destination: {
        server: `https://kubernetes.default.svc`,
        namespace: s.destination.namespace,
      },
      syncPolicy: {
        automated: {
          prune: true,
        },
      },
    },
  }
  return yaml.dump(application)
}
