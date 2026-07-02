// Sample catalog — in the real app this is served by the Node backend
// from data/books.json. Kept local here for the frontend-only draft.

export const spines = [
  { id: 's1', title: 'The Quiet Ones', author: 'M. Arora', color: '#7A2E2E', height: 236 },
  { id: 's2', title: 'Field Notes', author: 'D. Kapoor', color: '#1F4B43', height: 210 },
  { id: 's3', title: 'Half Moon Bay', author: 'S. Rhee', color: '#B85C2C', height: 250 },
  { id: 's4', title: 'Static', author: 'A. Voss', color: '#3A3F63', height: 222 },
  { id: 's5', title: 'Low Tide', author: 'R. Menon', color: '#5F7A61', height: 240 },
  { id: 's6', title: 'The Long Corridor', author: 'K. Iyer', color: '#93461F', height: 214 },
  { id: 's7', title: 'Paper Moths', author: 'L. Fischer', color: '#2E4057', height: 232 },
  { id: 's8', title: 'Ordinary Weather', author: 'N. Basu', color: '#7A5C2E', height: 218 },
];

export const genres = ['All', 'Fiction', 'Sci-Fi', 'Mystery', 'Self-Help', 'Poetry'];

export const books = [
  {
    id: 'b1',
    title: 'The Quiet Ones',
    author: 'M. Arora',
    genre: 'Fiction',
    price: 349,
    rating: 4.5,
    cover: '#7A2E2E',
  },
  {
    id: 'b2',
    title: 'Field Notes',
    author: 'D. Kapoor',
    genre: 'Self-Help',
    price: 299,
    rating: 4.2,
    cover: '#1F4B43',
  },
  {
    id: 'b3',
    title: 'Half Moon Bay',
    author: 'S. Rhee',
    genre: 'Mystery',
    price: 399,
    rating: 4.7,
    cover: '#B85C2C',
  },
  {
    id: 'b4',
    title: 'Static',
    author: 'A. Voss',
    genre: 'Sci-Fi',
    price: 449,
    rating: 4.3,
    cover: '#3A3F63',
  },
  {
    id: 'b5',
    title: 'Low Tide',
    author: 'R. Menon',
    genre: 'Poetry',
    price: 249,
    rating: 4.6,
    cover: '#5F7A61',
  },
  {
    id: 'b6',
    title: 'The Long Corridor',
    author: 'K. Iyer',
    genre: 'Mystery',
    price: 379,
    rating: 4.1,
    cover: '#93461F',
  },
  {
    id: 'b7',
    title: 'Paper Moths',
    author: 'L. Fischer',
    genre: 'Fiction',
    price: 329,
    rating: 4.4,
    cover: '#2E4057',
  },
  {
    id: 'b8',
    title: 'Ordinary Weather',
    author: 'N. Basu',
    genre: 'Self-Help',
    price: 279,
    rating: 4.0,
    cover: '#7A5C2E',
  },
];
