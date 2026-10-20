/* ------------------------------------------------------------------
   Ramp Load Master - aircraft / hold data
   One entry per aircraft type. Edit here if a layout needs fixing.

   Wide-body ("wide") holds:
     rows : number of AKE (LD3) rows in compartment 1|2 (FWD) or 3|4 (AFT)
            -> positions 11L/11R, 12L/12R ... 21L/21R ...
     pal  : number of 96x125 pallet positions in each compartment
            -> positions 11P, 12P ... 21P ...
   Narrow-body ("narrow") holds are bulk-loaded compartments:
     comps: compartment numbers shown on the layout (C1, C3 ...)
   door  : where the centre of the cargo door is, as a share of the hold
           length from the front (0 = front end, 1 = back end)
   doorW : door width in inches (draws the red door mark)
   side  : 'L' puts the door on the left (port) side; default is right.
           (787 bulk door is always on the left.)
------------------------------------------------------------------- */
self.RLM_FLEET = {
  B788: {
    name: 'Boeing 787-8', short: '787-8', kind: 'wide',
    codes: ['B788', '788', '787-8', '78G'],
    fwd: { rows: [4, 4], pal: [3, 2], door: 0.25, doorW: 106 },
    aft: { rows: [3, 3], pal: [2, 2], door: 0.62, doorW: 106 },
    bulk: { door: 0.5, doorW: 45, side: 'L' }
  },
  B789: {
    name: 'Boeing 787-9', short: '787-9', kind: 'wide',
    codes: ['B789', '789', '787-9', '78H'],
    fwd: { rows: [5, 5], pal: [3, 3], door: 0.25, doorW: 106 },
    aft: { rows: [4, 4], pal: [2, 3], door: 0.6, doorW: 106 },
    bulk: { door: 0.5, doorW: 45, side: 'L' }
  },
  B78X: {
    name: 'Boeing 787-10', short: '787-10', kind: 'wide',
    codes: ['B78X', '78J', '781', '787-10', '78X'],
    fwd: { rows: [6, 5], pal: [4, 3], door: 0.22, doorW: 106 },
    aft: { rows: [5, 4], pal: [3, 3], door: 0.6, doorW: 106 },
    bulk: { door: 0.5, doorW: 45, side: 'L' }
  },
  B77W: {
    name: '77W (Boeing 777-300ER)', short: '77W', kind: 'wide',
    codes: ['B77W', '77W', '777-300ER', '777-300EW', '773'],
    fwd: { rows: [6, 6], pal: [4, 4], door: 0.2, doorW: 106 },
    aft: { rows: [5, 5], pal: [3, 3], door: 0.6, doorW: 106 },
    bulk: { door: 0.5, doorW: 36 }
  },
  B77L: {
    name: 'Boeing 777-200LR', short: '777-200LR', kind: 'wide',
    codes: ['B77L', '77L', '777-200LR', '772'],
    fwd: { rows: [5, 4], pal: [3, 3], door: 0.22, doorW: 106 },
    aft: { rows: [4, 3], pal: [2, 2], door: 0.22, doorW: 70 },
    bulk: { door: 0.5, doorW: 35 }
  },
  A333: {
    name: 'Airbus A330-300', short: 'A330-300', kind: 'wide',
    codes: ['A333', '333', 'A330', 'A330-300', '330'],
    fwd: { rows: [4, 5], pal: [3, 3], door: 0.16, doorW: 106 },
    aft: { rows: [4, 3], pal: [2, 2], door: 0.2, doorW: 71 },
    bulk: { door: 0.5, doorW: 37 }
  },
  A319: {
    name: 'Airbus A319', short: 'A319', kind: 'narrow',
    codes: ['A319', '319'],
    fwd: { comps: ['1'], door: 0.5 }, aft: { comps: ['3', '4'], door: 0.3 }, bulk: { comps: ['5'], door: 0.5 }
  },
  A320: {
    name: 'Airbus A320', short: 'A320', kind: 'narrow',
    codes: ['A320', '320'],
    fwd: { comps: ['1'], door: 0.5 }, aft: { comps: ['3', '4'], door: 0.3 }, bulk: { comps: ['5'], door: 0.5 }
  },
  A321: {
    name: 'Airbus A321', short: 'A321', kind: 'narrow',
    codes: ['A321', '321'],
    fwd: { comps: ['1', '2'], door: 0.3 }, aft: { comps: ['3', '4'], door: 0.3 }, bulk: { comps: ['5'], door: 0.5 }
  },
  A21N: {
    name: 'Airbus A321XLR', short: 'A321XLR', kind: 'narrow',
    codes: ['A21N', 'XLR', 'A321XLR', '32Q'],
    fwd: { comps: ['1', '2'], door: 0.3 }, aft: { comps: ['4'], door: 0.5 }, bulk: { comps: ['5'], door: 0.5 },
    note: 'Rear centre fuel tank takes the front part of the aft hold.'
  },
  B38M: {
    name: 'Boeing 737 MAX 8', short: '737 MAX 8', kind: 'narrow',
    codes: ['B38M', '7M8', '737', '737-8', 'MAX8', '737MAX8'],
    fwd: { comps: ['1', '2'], door: 0.3 }, aft: { comps: ['3', '4'], door: 0.25 }
  },
  BCS3: {
    name: 'Airbus A220-300', short: 'A220-300', kind: 'narrow',
    codes: ['BCS3', '223', 'A220', 'A220-300', 'CS300'],
    fwd: { comps: ['1'], door: 0.5 }, aft: { comps: ['3'], door: 0.5 }
  }
};
self.RLM_FLEET_ORDER = ['B788', 'B789', 'B78X', 'B77W', 'B77L', 'A333', 'A319', 'A320', 'A321', 'A21N', 'B38M', 'BCS3'];
