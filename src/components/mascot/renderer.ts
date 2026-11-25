/**
 * Which renderer draws Milo. Swap this one line for a RiveRenderer later;
 * screens keep using <Milo /> unchanged.
 */
import { PuppetRenderer } from './puppet-renderer';
import type { MiloRenderer } from './types';

export const ActiveMiloRenderer: MiloRenderer = PuppetRenderer;
