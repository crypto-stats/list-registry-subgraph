const A_CODE = 'a'.charCodeAt(0)
const Z_CODE = 'z'.charCodeAt(0)
const SPACE_CODE = ' '.charCodeAt(0)

export function makeSlug(name: string | null): string | null {
  if (name == null) {
    return null
  }

  name = name!.toLowerCase()
  let slug = ''

  let space = false
  for (let i = 0; i < name.length; i += 1) {
    let code = name.charCodeAt(i)
    if (code >= A_CODE && code <= Z_CODE) {
      slug = slug + name.charAt(i)
      space = false
    } else if (code == SPACE_CODE) {
      if (!space) {
        slug = slug + '-'
        space = true
      }
    }
  }

  return slug
}