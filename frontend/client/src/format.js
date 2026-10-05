const pluralRules = new Intl.PluralRules('ru')

export function countLabel(count, one, few, many) {
  const forms = { one, few, many, other: many }
  return `${count} ${forms[pluralRules.select(count)]}`
}
