import { describe, expect, it } from 'vitest';
import { RegisterProfileUseCase } from './RegisterProfileUseCase.js';
import { ConflictError } from '../../../shared-kernel/application/errors.js';
import { DomainError } from '../../domain/errors.js';
import { FakeClock } from '../../../../test/unit/fakes/FakeClock.js';
import { FakeIdGenerator } from '../../../../test/unit/fakes/FakeIdGenerator.js';
import { FakeProfileRepository } from '../../../../test/unit/fakes/FakeProfileRepository.js';

describe('RegisterProfileUseCase', () => {
  it('creates and persists a profile with a generated id and the current time', async () => {
    const repository = new FakeProfileRepository();
    const useCase = new RegisterProfileUseCase(
      repository,
      new FakeIdGenerator(),
      new FakeClock(new Date('2026-01-01T00:00:00.000Z')),
    );

    const profile = await useCase.execute({ name: 'admin', authStrategy: { type: 'none' } });

    expect(profile.id).toBe('id-1');
    expect(profile.name).toBe('admin');
    expect(profile.authStrategy).toEqual({ type: 'none' });
    expect(profile.createdAt).toEqual(new Date('2026-01-01T00:00:00.000Z'));
    await expect(repository.findById('id-1')).resolves.toEqual(profile);
  });

  it('builds a "loginJourney" auth strategy via the domain factory', async () => {
    const useCase = new RegisterProfileUseCase(
      new FakeProfileRepository(),
      new FakeIdGenerator(),
      new FakeClock(),
    );

    const profile = await useCase.execute({
      name: 'admin',
      authStrategy: { type: 'loginJourney', journeyId: 'journey-1', storageStatePath: '/tmp/state.json' },
    });

    expect(profile.authStrategy).toEqual({
      type: 'loginJourney',
      journeyId: 'journey-1',
      storageStatePath: '/tmp/state.json',
    });
  });

  it('rejects a duplicate name with ConflictError, without persisting a second profile', async () => {
    const repository = new FakeProfileRepository();
    const useCase = new RegisterProfileUseCase(repository, new FakeIdGenerator(), new FakeClock());
    await useCase.execute({ name: 'admin', authStrategy: { type: 'none' } });

    await expect(useCase.execute({ name: 'admin', authStrategy: { type: 'none' } })).rejects.toThrow(
      ConflictError,
    );
    await expect(repository.findAll()).resolves.toHaveLength(1);
  });

  it('propagates a DomainError from an invalid authStrategy without persisting', async () => {
    const repository = new FakeProfileRepository();
    const useCase = new RegisterProfileUseCase(repository, new FakeIdGenerator(), new FakeClock());

    await expect(
      useCase.execute({ name: 'admin', authStrategy: { type: 'storageState', filePath: '' } }),
    ).rejects.toThrow(DomainError);
    await expect(repository.findAll()).resolves.toEqual([]);
  });
});
