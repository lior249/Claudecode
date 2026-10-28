// Exécute les tâches une par une, dans l'ordre d'arrivée, pour que deux événements
// ne modifient jamais les mêmes points en même temps. Une erreur est affichée sans arrêter le bot.
export function createQueue() {
  let tail = Promise.resolve();
  return function enqueue(task) {
    tail = tail.then(task).catch((error) => console.error('[PlugBot] Erreur :', error));
    return tail;
  };
}
