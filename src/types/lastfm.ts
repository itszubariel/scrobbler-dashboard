export interface LastFMUser {
  name: string;
  realname: string;
  image: { "#text": string; size: string }[];
  playcount: string;
  country: string;
  registered: { "#text": string };
}

export interface LastFMArtist {
  name: string;
  playcount: string;
  url: string;
  image: { "#text": string; size: string }[];
}

export interface LastFMTrack {
  name: string;
  playcount: string;
  url: string;
  artist: { name: string };
  image: { "#text": string; size: string }[];
}
