type NamespaceBranchInputs = {
  sourceRepository: string
  overlay: string
  namespace: string
}

export const getNamespaceBranch = (inputs: NamespaceBranchInputs) => {
  const [, sourceRepositoryName] = inputs.sourceRepository.split('/')
  return `ns/${sourceRepositoryName}/${inputs.overlay}/${inputs.namespace}`
}
