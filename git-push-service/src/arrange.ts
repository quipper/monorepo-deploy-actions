import * as core from '@actions/core'
import * as fs from 'fs/promises'
import * as io from '@actions/io'
import * as path from 'path'
import * as yaml from 'js-yaml'

type Inputs = {
  workspace: string
  manifests: string[]
  namespace: string
  service: string
  project: string
  branch: string
  applicationAnnotations: string[]
  destinationRepository: string
  currentHeadRef: string
  currentHeadSha: string
}

export const writeManifests = async (inputs: Inputs): Promise<void> => {
  await writeServiceManifest(inputs.manifests, `${inputs.workspace}/services/${inputs.service}/generated.yaml`)
  await writeApplicationManifest(inputs)
}

const writeServiceManifest = async (sourcePaths: string[], destinationPath: string) => {
  const sourceContents = await Promise.all(
    sourcePaths.map(async (manifestPath) => await fs.readFile(manifestPath, 'utf-8')),
  )
  const concatManifest = sourceContents.join('\n---\n')
  core.info(`Writing the service manifest to ${destinationPath}`)
  await io.mkdirP(path.dirname(destinationPath))
  await fs.writeFile(destinationPath, concatManifest)
}

const writeApplicationManifest = async (inputs: Inputs) => {
  const application = {
    apiVersion: 'argoproj.io/v1alpha1',
    kind: 'Application',
    metadata: {
      name: `${inputs.namespace}--${inputs.service}`,
      namespace: 'argocd',
      finalizers: ['resources-finalizer.argocd.argoproj.io'],
      annotations: {
        ...parseApplicationAnnotations(inputs.applicationAnnotations),
        'github.head-ref': inputs.currentHeadRef,
        'github.head-sha': inputs.currentHeadSha,
        'github.action': 'git-push-service',
      },
    },
    spec: {
      project: inputs.project,
      source: {
        repoURL: `https://github.com/${inputs.destinationRepository}.git`,
        targetRevision: inputs.branch,
        path: `services/${inputs.service}`,
      },
      destination: {
        server: `https://kubernetes.default.svc`,
        namespace: inputs.namespace,
      },
      syncPolicy: {
        automated: {
          prune: true,
        },
      },
    },
  }

  await io.mkdirP(`${inputs.workspace}/applications`)
  const destination = `${inputs.workspace}/applications/${application.metadata.name}.yaml`
  core.info(`Writing the application manifest to ${destination}`)
  await fs.writeFile(destination, yaml.dump(application))
}

const parseApplicationAnnotations = (applicationAnnotations: string[]): Record<string, string> => {
  const r: Record<string, string> = {}
  for (const s of applicationAnnotations) {
    const k = s.substring(0, s.indexOf('='))
    const v = s.substring(s.indexOf('=') + 1)
    r[k] = v
  }
  return r
}
