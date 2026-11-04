import React from 'react';
import {SC01} from './SC01';
import {SC02} from './SC02';
import {SC03} from './SC03';
import {SC04} from './SC04';
import {SC05} from './SC05';
import {SC06} from './SC06';
import {SC07} from './SC07';
import {SC08} from './SC08';
import {SC09} from './SC09';
import {SC10} from './SC10';
import {SC11} from './SC11';
import {SC12} from './SC12';
import {SC13} from './SC13';
import {SC14} from './SC14';
import {SC15} from './SC15';
import {SC16} from './SC16';
import {SC17} from './SC17';

export type ShotReg = {id: string; first: string; last: string; Comp: React.FC};
export const SHOTS: ShotReg[] = [
  {id: 'SC01', first: 'S01', last: 'S03', Comp: SC01},
  {id: 'SC02', first: 'S04', last: 'S07', Comp: SC02},
  {id: 'SC03', first: 'S08', last: 'S09', Comp: SC03},
  {id: 'SC04', first: 'S10', last: 'S13', Comp: SC04},
  {id: 'SC05', first: 'S14', last: 'S17', Comp: SC05},
  {id: 'SC06', first: 'S18', last: 'S19', Comp: SC06},
  {id: 'SC07', first: 'S20', last: 'S23', Comp: SC07},
  {id: 'SC08', first: 'S24', last: 'S25', Comp: SC08},
  {id: 'SC09', first: 'S26', last: 'S30', Comp: SC09},
  {id: 'SC10', first: 'S31', last: 'S34', Comp: SC10},
  {id: 'SC11', first: 'S35', last: 'S36', Comp: SC11},
  {id: 'SC12', first: 'S37', last: 'S42', Comp: SC12},
  {id: 'SC13', first: 'S43', last: 'S44', Comp: SC13},
  {id: 'SC14', first: 'S45', last: 'S48', Comp: SC14},
  {id: 'SC15', first: 'S49', last: 'S52', Comp: SC15},
  {id: 'SC16', first: 'S53', last: 'S53', Comp: SC16},
  {id: 'SC17', first: 'S54', last: 'S57', Comp: SC17},
];
