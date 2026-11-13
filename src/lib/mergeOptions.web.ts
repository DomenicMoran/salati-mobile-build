type Mergeable = Record<string, unknown> | undefined;

function mergeOptions(...options: Mergeable[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const option of options) {
    if (option && typeof option === 'object') {
      Object.assign(result, option);
    }
  }
  return result;
}

export default mergeOptions;
