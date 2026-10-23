// Student & Teacher Classroom Assignments is now seamlessly handled
// directly from the Classroom cards in the Sections module via the 2-column modal.
export async function renderAssignmentsModule(container, { onNavigate }) {
  if (onNavigate) {
    onNavigate('sections');
  }
}
