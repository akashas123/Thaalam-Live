import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Hls from 'hls.js';
import { ArrowUpRight, Disc3, Headphones, Pause, Play, Radio, SkipBack, SkipForward, Volume2 } from 'lucide-react';
import './styles.css';

const streamUrl = 'https://radio.thaalam24x7.in/hls/thaalam_24x7/aac_hifi.m3u8';
const apiBase = 'https://radio.thaalam24x7.in/api';
const fallbackTracks = [
  { rank: '01', title: 'End of Beginning', artist: 'Djo', cover: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=800&q=85' },
  { rank: '02', title: 'Beautiful Things', artist: 'Benson Boone', cover: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=800&q=85' },
  { rank: '03', title: 'Good Luck, Babe!', artist: 'Chappell Roan', cover: 'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?auto=format&fit=crop&w=800&q=85' },
  { rank: '04', title: 'I Had Some Help', artist: 'Post Malone', cover: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=800&q=85' },
];

const fallbackCover = 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=800&q=85';

const BrandMark = () => <span className="brand-mark" aria-hidden="true"><span className="brand-bars"><i className="bar-short" /><i className="bar-medium" /><i className="bar-tall" /><i className="bar-medium" /><i className="bar-short" /></span></span>;
const DiscLogo = () => <span className="disc-logo-bars" aria-hidden="true"><i className="bar-short" /><i className="bar-medium" /><i className="bar-tall" /><i className="bar-medium" /><i className="bar-short" /></span>;

const formatScheduleTime = (value, endValue) => {
  const format = (input) => {
    if (!input) return '';
    const date = new Date(input);
    if (!Number.isNaN(date.getTime())) return new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(date.getTime() + 2 * 60 * 1000));
    return String(input).replace(/^\d{4}-\d{2}-\d{2}T?/, '').slice(0, 5);
  };
  const start = format(value);
  const end = format(endValue);
  return end ? `${start} — ${end}` : start || 'On air';
};

const pickScheduleWindow = (items) => {
  const now = Date.now();
  const parsed = items.map((item) => ({ ...item, _start: new Date(item.start || item.start_time || item.startTime).getTime(), _end: new Date(item.end || item.end_time || item.endTime).getTime() })).filter((item) => Number.isFinite(item._start));
  const currentIndex = parsed.findIndex((item) => item.is_now) >= 0 ? parsed.findIndex((item) => item.is_now) : parsed.findIndex((item) => item._start <= now && (!Number.isFinite(item._end) || item._end >= now));
  const index = currentIndex >= 0 ? currentIndex : parsed.findIndex((item) => item._start > now);
  if (index < 0) return items.slice(0, 3);
  return [parsed[index - 1], parsed[index], parsed[index + 1]].filter(Boolean).map((item, offset) => ({ ...item, state: ['PREV', 'NOW', 'NEXT'][offset] }));
};

function App() {
  const audioRef = useRef(null);
  const streamReadyRef = useRef(false);
  const pendingPlayRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(.72);
  const [currentTrack, setCurrentTrack] = useState(fallbackTracks[0]);
  const [chartTracks, setChartTracks] = useState(fallbackTracks);
  const [previewTrack, setPreviewTrack] = useState(null);
  const [popNews, setPopNews] = useState([]);
  const [chartsRevealed, setChartsRevealed] = useState(false);
  const previewAudioRef = useRef(null);
  const [schedule, setSchedule] = useState([
    { start: '06 — 10', state: 'PREV', name: 'First Light', description: 'Fresh releases before the city wakes up.', icon: Headphones },
    { start: '18 — 22', state: 'NOW', name: 'After Hours', description: 'Long-form listening for the long way home.', icon: Radio, featured: true },
    { start: '22 — 02', state: 'NEXT', name: 'Night Drive', description: 'Low lights, new voices, no rush.', icon: Disc3 },
  ]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    let hls;
    if (audio.canPlayType('application/vnd.apple.mpegurl')) {
      audio.src = streamUrl;
      audio.addEventListener('loadedmetadata', () => { streamReadyRef.current = true; if (pendingPlayRef.current) audio.play().then(() => { pendingPlayRef.current = false; setPlaying(true); }).catch(() => {}); }, { once: true });
    }
    else if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        startPosition: -1,
        liveSyncDurationCount: 1,
        liveMaxLatencyDurationCount: 3,
        maxLiveSyncPlaybackRate: 1.5,
        maxBufferLength: 6,
        backBufferLength: 0,
      });
      hls.loadSource(streamUrl);
      hls.attachMedia(audio);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        streamReadyRef.current = true;
        if (pendingPlayRef.current) audio.play().then(() => { pendingPlayRef.current = false; setPlaying(true); }).catch(() => setPlaying(false));
      });
      hls.on(Hls.Events.ERROR, (_, data) => { if (data.fatal) { pendingPlayRef.current = false; setPlaying(false); } });
    }
    return () => hls?.destroy();
  }, []);

  useEffect(() => {
    const loadNews = async () => {
      try {
        const response = await fetch('/api/pop-news');
        const xml = await response.text();
        const doc = new DOMParser().parseFromString(xml, 'text/xml');
        const items = [...doc.querySelectorAll('item')].slice(0, 4).map((item) => ({
          title: item.querySelector('title')?.textContent?.replace(/\s+-\s+[^-]+$/, '') || 'Pop music update',
          source: item.querySelector('source')?.textContent || 'Pop music news',
          date: item.querySelector('pubDate')?.textContent || '',
          link: item.querySelector('link')?.textContent || '#',
          image: item.getElementsByTagName('media:content')[0]?.getAttribute('url') || item.getElementsByTagName('media:thumbnail')[0]?.getAttribute('url') || item.querySelector('enclosure')?.getAttribute('url') || '',
        }));
        if (items.length) setPopNews(items);
      } catch {}
    };
    loadNews();
    const refreshTimer = setInterval(loadNews, 10 * 60 * 1000);
    return () => clearInterval(refreshTimer);
  }, []);

  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume; }, [volume]);

  useEffect(() => {
    const loadSchedule = async () => {
      try {
        const response = await fetch(`${apiBase}/station/6/schedule`, { cache: 'no-store' });
        const payload = await response.json();
        const items = Array.isArray(payload) ? payload : payload?.data || payload?.schedule;
        if (!Array.isArray(items) || !items.length) return;
        const selected = pickScheduleWindow(items).slice(0, 3);
        while (selected.length < 3) {
          const last = selected[selected.length - 1];
          const lastEnd = last?.end || last?.end_time || last?.endTime;
          const nextTemplate = items.find((entry) => (entry.name || entry.title || entry.program?.name) !== (last?.name || last?.title || last?.program?.name)) || items[0];
          const nextStart = lastEnd && !Number.isNaN(new Date(lastEnd).getTime()) ? new Date(lastEnd).toISOString() : new Date(Date.now() + 3600000).toISOString();
          selected.push({ ...nextTemplate, start: nextStart, name: nextTemplate.name || nextTemplate.title || nextTemplate.program?.name || 'Thaalam 24x7', state: 'NEXT' });
        }
        setSchedule(selected.map((item, index) => ({
          start: formatScheduleTime(item.start || item.start_time || item.startTime, item.end || item.end_time || item.endTime),
          state: item.state || ['PREV', 'NOW', 'NEXT'][index],
          name: item.name || item.title || item.program?.name || 'Thaalam 24x7',
          description: item.description || item.program?.description || 'Live programming from Thaalam 24x7.',
          icon: [Headphones, Radio, Disc3][index % 3],
          featured: index === 0,
        })));
      } catch {}
    };
    loadSchedule();
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      const direction = document.documentElement.dataset.scrollDirection || 'down';
      if (entry.isIntersecting && direction === 'down') {
        entry.target.classList.add('is-visible');
        if (entry.target.classList.contains('chart-card')) setChartsRevealed(true);
      }
    }), { threshold: .12, rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('[data-reveal]').forEach((item) => observer.observe(item));
    let previousScrollY = window.scrollY;
    let heroFalling = window.scrollY > (window.innerWidth <= 800 ? window.innerHeight * .5 : 20);
    const onScroll = () => {
      const direction = window.scrollY >= previousScrollY ? 'down' : 'up';
      document.documentElement.dataset.scrollDirection = direction;
      document.documentElement.classList.toggle('scroll-down', direction === 'down');
      document.documentElement.classList.toggle('scroll-up', direction === 'up');
      const heroFallThreshold = window.innerWidth <= 800 ? window.innerHeight * .5 : 20;
      const heroReturnThreshold = window.innerWidth <= 800 ? heroFallThreshold : 700;
      if (direction === 'down' && window.scrollY > heroFallThreshold) heroFalling = true;
      if (direction === 'up' && window.scrollY < heroReturnThreshold) heroFalling = false;
      document.documentElement.classList.toggle('hero-falling', heroFalling);
      if (window.scrollY <= 4 && previousScrollY > 4) {
        document.querySelectorAll('[data-reveal]').forEach((item) => item.classList.remove('is-visible'));
      }
      previousScrollY = window.scrollY;
      document.documentElement.style.setProperty('--scroll-y', `${window.scrollY}px`);
      document.documentElement.style.setProperty('--disc-progress', `${Math.min(1, window.scrollY / 700)}`);
      document.documentElement.style.setProperty('--badge-progress', `${Math.min(1, window.scrollY / 80)}`);
      document.documentElement.style.setProperty('--scroll-progress', `${window.scrollY / Math.max(1, document.body.scrollHeight - window.innerHeight)}`);
    };
    onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
    return () => { observer.disconnect(); window.removeEventListener('scroll', onScroll); };
  }, [popNews.length, chartTracks.length]);

  useEffect(() => {
    const loadData = async () => {
      const addPreviews = async (tracks) => Promise.all(tracks.map(async (track) => {
        if (track.previewUrl) return track;
        const query = encodeURIComponent(`${track.title} ${track.artist}`);
        for (const endpoint of [`/api/itunes?term=${query}`, `https://itunes.apple.com/search?term=${query}&entity=song&limit=1`]) {
          try {
            const result = await fetch(endpoint);
            const payload = await result.json();
            const match = payload?.results?.[0];
            if (match) return { ...track, previewUrl: match.previewUrl, cover: match.artworkUrl100?.replace('100x100', '600x600') || track.cover };
          } catch {}
        }
        return track;
      }));
      // Load live metadata independently so it is not held up by the chart request.
      try {
        const response = await fetch(`${apiBase}/nowplaying/6`, { cache: 'no-store' });
        const payload = await response.json(); const station = Array.isArray(payload) ? payload[0] : payload;
        const song = station?.now_playing?.song || station?.playing_next?.song;
        const artwork = song?.art || song?.album_art || song?.artwork || station?.now_playing?.song?.art || fallbackCover;
        if (song?.title) setCurrentTrack({ ...fallbackTracks[0], title: song.title, artist: song.artist || song.artist_name || 'Thaalam 24x7', cover: artwork });
      } catch {}
      try {
        const chartPayload = await Promise.any([
          '/api/charts',
          'https://rss.marketingtools.apple.com/api/v2/us/music/most-played/10/songs.json',
          'https://itunes.apple.com/us/rss/topsongs/limit=10/json',
        ].map(async (endpoint) => {
          const response = await fetch(endpoint, { cache: 'no-store' });
          if (!response.ok) throw new Error(`Chart request failed: ${response.status}`);
          return response.json();
        }));
        const appleTracks = chartPayload?.feed?.results || chartPayload?.results || chartPayload?.data || chartPayload?.feed?.entry?.map((entry) => ({
          name: entry['im:name']?.label,
          artistName: entry['im:artist']?.label,
          artworkUrl100: entry['im:image']?.at(-1)?.label,
        }));
        if (Array.isArray(appleTracks) && appleTracks.length) {
          const mappedTracks = appleTracks.map((item, index) => ({
          rank: String(index + 1).padStart(2, '0'),
          title: item.name,
          artist: item.artistName,
          cover: item.artworkUrl100?.replace('100x100', '600x600') || fallbackTracks[index % fallbackTracks.length].cover,
          }));
          setChartTracks(mappedTracks);
          addPreviews(mappedTracks).then(setChartTracks).catch(() => {});
        } else {
          setChartTracks(fallbackTracks);
          addPreviews(fallbackTracks).then(setChartTracks).catch(() => {});
        }
      } catch {
        setChartTracks(fallbackTracks);
        addPreviews(fallbackTracks).then(setChartTracks).catch(() => {});
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadLiveTrack = async () => {
      try {
        const response = await fetch(`${apiBase}/nowplaying/6`, { cache: 'no-store' });
        const payload = await response.json();
        const station = Array.isArray(payload) ? payload[0] : payload;
        const song = station?.now_playing?.song;
        const cover = song?.art || song?.album_art || song?.artwork || station?.now_playing?.song?.art;
        if (!cancelled && song?.title) setCurrentTrack((previous) => ({ ...previous, title: song.title, artist: song.artist || song.artist_name || 'Thaalam 24x7', cover: cover || previous.cover }));
      } catch {}
    };
    loadLiveTrack();
    const timer = setInterval(loadLiveTrack, 15000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (!previewTrack) return;
    const audio = previewAudioRef.current;
    if (!audio) return;
    audio.src = previewTrack.previewUrl;
    audio.currentTime = 0;
    audio.play().catch(() => setPreviewTrack(null));
    const stop = () => setPreviewTrack(null);
    audio.addEventListener('ended', stop);
    return () => audio.removeEventListener('ended', stop);
  }, [previewTrack]);

  const toggleAudio = async () => {
    const audio = audioRef.current; if (!audio) return;
    if (playing) { pendingPlayRef.current = false; audio.pause(); setPlaying(false); return; }
    if (!streamReadyRef.current) { pendingPlayRef.current = true; setPlaying(true); return; }
    try { await audio.play(); setPlaying(true); } catch { setPlaying(false); }
  };

  const togglePreview = (track) => {
    if (!track.previewUrl) return;
    if (previewTrack?.title === track.title) {
      previewAudioRef.current?.pause();
      setPreviewTrack(null);
    } else setPreviewTrack(track);
  };

  const navigateToSection = (event, selector) => {
    event.preventDefault();
    const section = document.querySelector(selector);
    if (!section) return;
    section.querySelectorAll('[data-reveal]').forEach((element) => {
      element.classList.remove('is-visible');
      void element.offsetWidth;
      element.classList.add('is-visible');
    });
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return <>
    <audio ref={audioRef} preload="auto" playsInline onPlaying={() => setPlaying(true)} onPause={() => { if (!pendingPlayRef.current) setPlaying(false); }} onError={() => { pendingPlayRef.current = false; setPlaying(false); }} />
    <audio ref={previewAudioRef} preload="none" />
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="site-header"><a className="brand" href="#top"><BrandMark /><span>THAALAM 24x7</span></a><nav><a href="#listen" onClick={(event) => navigateToSection(event, '#listen')}>Listen</a><a href="#charts" onClick={(event) => navigateToSection(event, '#charts')}>Charts</a><a href="#shows" onClick={(event) => navigateToSection(event, '#shows')}>Shows</a><a href="#news" onClick={(event) => navigateToSection(event, '#news')}>News</a></nav><button className="header-play" onClick={toggleAudio}>{playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />} {playing ? 'Pause live' : 'Play live'}</button></header>
    <main id="main">
      <section className="hero" id="top"><div className="hero-copy"><p className="eyebrow"><span className="live-dot" /> Live Worldwide</p><h1>Radio for the<br /><em>chart hits.</em></h1><p className="hero-intro">A live station for new sounds, late-night discoveries, and the songs that stay after the room goes quiet.</p><div className="hero-actions"><button className="button button-primary" onClick={toggleAudio}>{playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />} {playing ? 'Pause radio' : 'Listen live'}</button><a className="text-link" href="#charts" onClick={(event) => navigateToSection(event, '#charts')}>See the charts <ArrowUpRight size={16} /></a></div></div><div className="hero-art"><div className="record-shell"><div className="record"><div className="record-label"><DiscLogo /></div></div></div><div className="hero-sticker">ON AIR<br /><span>24 / 7</span></div></div><div className="hero-foot"><span></span><span>Scroll to live room</span><span className="hero-line" /></div></section>
      <section className="player-section" id="listen"><div className="section-intro"><p className="eyebrow">The live room</p><h2>Now playing.</h2></div><div className="player-card" data-reveal="rise"><div className="player-art"><img draggable="false" src={currentTrack.cover || fallbackCover} alt="Current album artwork" onError={(e) => { e.currentTarget.src = fallbackCover; }} /><div className="art-disc"><Disc3 size={36} /></div></div><div className="player-info"><span className="live-label"><span className="live-dot" /> On air now</span><h3>{currentTrack.title}</h3><p>{currentTrack.artist}</p><div className="waveform">{Array.from({ length: 34 }, (_, i) => <span key={i} style={{ '--i': i }} />)}</div><div className="player-controls"><button className="play-button" onClick={toggleAudio}>{playing ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}</button><div className="track-time"><span>Live</span><span>Thaalam 24x7</span></div><Volume2 size={18} /><input aria-label="Volume" type="range" min="0" max="1" step=".01" value={volume} onChange={(e) => setVolume(Number(e.target.value))} /></div></div></div></section>
      <section className="chart-section" id="charts"><div className="chart-header"><div><p className="eyebrow">Global pop · trending now</p><h2>The chart, <span>right now.</span></h2></div></div><div className="chart-grid">{chartTracks.map((track, index) => <article className={`chart-card${chartsRevealed ? ' is-visible' : ''}${previewTrack?.title === track.title ? ' is-previewing' : ''}`} data-reveal="rise" style={{ '--delay': `${index * 90}ms` }} key={`${track.rank}-${track.title}`}><div className="chart-rank">{track.rank}</div><button className="chart-cover" onClick={() => togglePreview(track)} aria-label={`${previewTrack?.title === track.title ? 'Pause' : 'Play'} ${track.title}`}><img draggable="false" src={track.cover || fallbackCover} alt={`${track.title} album art`} onError={(e) => { e.currentTarget.src = fallbackCover; }} /><span className="chart-play">{previewTrack?.title === track.title ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}</span></button><div className="chart-meta"><h3>{track.title}</h3><p>{track.artist}</p></div></article>)}</div></section>
      <section className="shows-section" id="shows"><div className="shows-copy"><p className="eyebrow">Broadcast schedule</p><h2>Stay for<br /><em>the side B.</em></h2><p>Three shows, one long thread through the week. New music in the morning, deep cuts after dark.</p><a className="button button-light" href="#shows" onClick={(event) => navigateToSection(event, '#shows')}>See the schedule <ArrowUpRight size={16} /></a></div><div className="show-list">{schedule.slice(0, 3).map((show, index) => { const Icon = show.state === 'PREV' ? SkipBack : show.state === 'NEXT' ? SkipForward : Radio; return <div className={`show-row${show.featured || show.state === 'NOW' ? ' featured' : ''}`} data-reveal="side" style={{ '--delay': `${index * 120}ms` }} key={`${show.state || index}-${index}-${show.start}-${show.name}`}><span><small>{show.state || ['PREV', 'NOW', 'NEXT'][index]}</small><time>{show.start}</time></span><div><h3>{show.name}</h3></div><Icon size={20} /></div>; })}</div></section>
      <section className="trending-section" id="news"><div className="trending-copy"><p className="eyebrow">Pop music, right now</p><h2>What’s<br /><em>moving.</em></h2><p>The latest stories, releases, and moments shaping pop culture beyond the playlist.</p></div><div className="news-list">{popNews.length ? popNews.map((story, index) => <a className="news-item" data-reveal="rise" href={story.link} target="_blank" rel="noreferrer" key={`${story.title}-${index}`}><span className="news-source">{story.source}</span><strong>{story.title}</strong><small className="news-date">{story.date ? new Date(story.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : 'Latest'}</small><ArrowUpRight size={16} /></a>) : <div className="news-empty"><Disc3 size={24} /><span>Loading pop music news…</span></div>}</div></section>
    </main>
    <footer className="site-footer"><a className="brand" href="#top"><BrandMark /><span>THAALAM 24x7</span></a><a className="footer-player-link" href="https://web.thaalam24x7.in">Web Player <ArrowUpRight size={14} aria-hidden="true" /></a><span>© 2026 Thaalam 24x7</span></footer>
  </>;
}

createRoot(document.getElementById('root')).render(<App />);
