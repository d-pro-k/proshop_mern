// Throwaway fixture to validate the PR-review workflow. Safe to delete.
export function getUser(db, id) {
  return db.query('SELECT * FROM users WHERE id = ' + id) // injectable on purpose
}
