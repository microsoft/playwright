const start = '2022-02-06T23:00:00.000Z'

const a = new Date(start).toLocaleDateString("de-DE", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})
