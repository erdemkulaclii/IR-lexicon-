export const wars = {
  six_day_war: {
    name: 'Six-Day War (1967)',
    duration: 20000,

    days: ['June 5', 'June 6', 'June 7', 'June 8', 'June 9', 'June 10'],

    events: [
      { day: 0, text: 'Operation Focus: Israeli air force destroys Egyptian airbases' },
      { day: 1, text: 'Israeli forces advance into Sinai Peninsula' },
      { day: 2, text: 'Gaza Strip captured' },
      { day: 3, text: 'West Bank offensive begins' },
      { day: 4, text: 'East Jerusalem captured' },
      { day: 5, text: 'Golan Heights taken from Syria' },
    ],

    units: [
      {
        type: 'plane',
        speed: 2.5,
        path: [
          [31.25, 34.79],
          [30.05, 31.25],
        ],
      },
      {
        type: 'plane',
        speed: 2.5,
        path: [
          [31.25, 34.79],
          [30.8, 29.0],
        ],
      },
      {
        type: 'tank',
        speed: 1.2,
        path: [
          [31.25, 34.79],
          [30.5, 33.0],
          [30.1, 32.3],
        ],
      },
      {
        type: 'tank',
        speed: 1.1,
        path: [
          [31.78, 35.21],
          [32.0, 35.4],
        ],
      },
      {
        type: 'tank',
        speed: 1,
        path: [
          [32.8, 35.6],
          [33.0, 36.0],
        ],
      },
    ],
  },

  yom_kippur: {
    name: 'Yom Kippur War (1973)',
    duration: 25000,

    days: ['Oct 6', 'Oct 7', 'Oct 8', 'Oct 9', 'Oct 10', 'Oct 11', 'Oct 12'],

    events: [
      { day: 0, text: 'Egypt and Syria launch surprise attack' },
      { day: 1, text: 'Egypt crosses Suez Canal' },
      { day: 2, text: 'Syrian advance in Golan Heights' },
      { day: 3, text: 'Israeli defensive mobilization' },
      { day: 4, text: 'Counterattack in Sinai begins' },
      { day: 5, text: 'Israeli forces cross west of Suez' },
      { day: 6, text: 'Ceasefire negotiations begin' },
    ],

    units: [
      {
        type: 'tank',
        speed: 0.9,
        path: [
          [30.0, 32.5],
          [30.5, 32.8],
        ],
      },
      {
        type: 'tank',
        speed: 1,
        path: [
          [33.0, 36.2],
          [32.8, 35.8],
        ],
      },
      {
        type: 'plane',
        speed: 2,
        path: [
          [31.25, 34.79],
          [32.8, 35.8],
        ],
      },
      {
        type: 'tank',
        speed: 1.1,
        path: [
          [30.5, 33.0],
          [30.0, 32.4],
        ],
      },
    ],
  },
};
