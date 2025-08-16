import { StatusesPriority } from '../data'

export function sortStatusesByPriority(statuses: string[]): string[] {
    // Sort statuses according to the defined priority order
    return statuses.sort((a, b) => {
        const priorityA = StatusesPriority.indexOf(a)
        const priorityB = StatusesPriority.indexOf(b)

        // If the status is not found in the priority list, place it at the end
        return priorityA - priorityB
    })
}
