import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findPermissionProblems } from '../src/checks.js';

function setup({ missing = {}, manageRoles = true, botPosition = 10, rolePositions = {} } = {}) {
  const config = {
    roles: { free: 'r-free', plug: 'r-tiktok', streak: 'r-feu', weekWinner: 'r-p7', monthWinner: 'r-p30', prisoner: 'r-pri' },
  };
  const position = (role) => role.position;
  const roles = new Map(
    Object.values(config.roles).map((id) => [
      id,
      { id, name: id, position: rolePositions[id] ?? 1 },
    ]),
  );
  const me = {
    permissions: { has: (perm) => perm !== 'ManageRoles' || manageRoles },
    roles: { highest: { comparePositionTo: (role) => botPosition - position(role) } },
  };
  const channel = (name) => ({ name, permissionsFor: () => ({ missing: () => missing[name] ?? [] }) });
  const channels = Object.fromEntries(['results', 'showup', 'week', 'month', 'prison'].map((key) => [key, channel(key)]));
  return { config, guild: { members: { me }, roles: { cache: roles } }, channels };
}

describe('findPermissionProblems', () => {
  it('ne signale rien quand tout est en place', () => {
    assert.deepEqual(findPermissionProblems(setup()), []);
  });

  it('explique en français les permissions manquantes dans un salon', () => {
    const problems = findPermissionProblems(setup({ missing: { showup: ['SendMessages'] } }));
    assert.deepEqual(problems, ['#showup : il manque Envoyer des messages.']);
  });

  it('signale un rôle placé au-dessus de PlugBot', () => {
    const problems = findPermissionProblems(setup({ rolePositions: { 'r-pri': 12 } }));
    assert.deepEqual(problems, ['Le rôle de PlugBot doit être placé au-dessus du rôle r-pri.']);
  });

  it('ignore la position des rôles Free et TikTok, que PlugBot ne donne pas', () => {
    assert.deepEqual(findPermissionProblems(setup({ rolePositions: { 'r-free': 50 } })), []);
  });

  it('signale la permission Gérer les rôles', () => {
    assert.deepEqual(findPermissionProblems(setup({ manageRoles: false })), ['Il manque la permission « Gérer les rôles ».']);
  });
});
