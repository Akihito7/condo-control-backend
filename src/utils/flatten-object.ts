export function flattenObject(obj) {
  const result = {};

  for (const key in obj) {
    if (
      obj[key] !== null &&
      typeof obj[key] === 'object' &&
      !Array.isArray(obj[key])
    ) {
      for (const nestedKey in obj[key]) {
        result[`${key}_${nestedKey}`] = obj[key][nestedKey];
      }
    } else {
      result[key] = obj[key];
    }
  }

  return result;
}
