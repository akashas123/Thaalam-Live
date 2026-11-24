import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Hls from 'hls.js';
import { ArrowUpRight, Disc3, FastForward, Pause, Play, Radio, SkipForward, Volume2 } from 'lucide-react';
import './styles.css';

const streamUrl = 'https://radio.thaalam24x7.in/hls/thaalam_24x7/aac_hifi.m3u8';
const apiBase = import.meta.env.DEV ? 'https://radio.thaalam24x7.in/api' : '/api/radio';
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

const isFlagged = (item, flag) => item?.[flag] === true || item?.[flag] === 1 || item?.[flag] === '1' || item?.[flag] === 'true';
const scheduleName = (item) => item?.name || item?.title || item?.program?.name || item?.program?.title || 'Programme unavailable';
const scheduleStart = (item) => item?.start || item?.start_time || item?.startTime;
const scheduleEnd = (item) => item?.end || item?.end_time || item?.endTime;

const parseScheduleDate = (value, now = Date.now()) => {
  if (!value) return NaN;
  const parsed = new Date(value).getTime();
  if (Number.isFinite(parsed)) return parsed;
  const match = String(value).trim().match(/^(\d{1,2}):?(\d{2})(?:\s*([ap]m))?$/i);
  if (!match) return NaN;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toLowerCase();
  if (meridiem === 'pm' && hour < 12) hour += 12;
  if (meridiem === 'am' && hour === 12) hour = 0;
  const date = new Date(now);
  date.setHours(hour, minute, 0, 0);
  return date.getTime();
};

const scheduleKey = (item) => `${scheduleName(item)}|${scheduleStart(item) || ''}|${scheduleEnd(item) || ''}`;

const formatNewsDate = (value) => {
  if (!value) return 'Latest';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Latest';
  const elapsed = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
};

const selectSchedulePrograms = (items) => {
  const now = Date.now();
  const parsed = items.map((item) => {
    const start = parseScheduleDate(scheduleStart(item), now);
    let end = parseScheduleDate(scheduleEnd(item), now);
    if (Number.isFinite(start) && Number.isFinite(end) && end < start) end += 24 * 60 * 60 * 1000;
    return { ...item, _start: start, _end: end, _key: scheduleKey(item) };
  }).filter((item) => Number.isFinite(item._start));
  const unique = [...new Map(parsed.map((item) => [item._key, item])).values()].sort((a, b) => a._start - b._start);
  if (!unique.length) return [];

  const nowProgram = unique.find((item) => isFlagged(item, 'is_now')) || unique.find((item) => item._start <= now && (!Number.isFinite(item._end) || item._end >= now)) || unique[0];
  const nextProgram = unique.find((item) => item._key !== nowProgram._key && isFlagged(item, 'is_next')) || unique.find((item) => item._key !== nowProgram._key && item._start > nowProgram._start) || unique.find((item) => item._key !== nowProgram._key);
  const laterProgram = nextProgram && (unique.find((item) => item._key !== nowProgram._key && item._key !== nextProgram._key && item._start > nextProgram._start) || unique.find((item) => item._key !== nowProgram._key && item._key !== nextProgram._key));
  return [
    nowProgram && { ...nowProgram, state: 'NOW' },
    nextProgram && { ...nextProgram, state: 'NEXT' },
    laterProgram && { ...laterProgram, state: 'LATER' },
  ].filter(Boolean);
};

function App() {
  const audioRef = useRef(null);
  const streamReadyRef = useRef(false);
  const pendingPlayRef = useRef(false);
  const radioStartedRef = useRef(false);
  const hlsRef = useRef(null);
  const playRetryRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [volume, setVolume] = useState(.72);
  const [currentTrack, setCurrentTrack] = useState(fallbackTracks[0]);
  const [chartTracks, setChartTracks] = useState(fallbackTracks);
  const [previewTrack, setPreviewTrack] = useState(null);
  const [popNews, setPopNews] = useState([]);
  const [chartsRevealed, setChartsRevealed] = useState(false);
  const previewAudioRef = useRef(null);
  const [schedule, setSchedule] = useState([]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    audio.muted = true;
    let hls;
    const retryPlayback = () => {
      clearTimeout(playRetryRef.current);
      playRetryRef.current = setTimeout(() => {
        if (!pendingPlayRef.current) return;
        hlsRef.current?.startLoad(-1);
        audio.play().catch(() => retryPlayback());
      }, 750);
    };
    const tryStartPlayback = () => {
      if (!pendingPlayRef.current) return;
      audio.play().then(() => {
        radioStartedRef.current = true;
      }).catch(() => retryPlayback());
    };
    const handleCanPlay = () => {
      streamReadyRef.current = true;
      tryStartPlayback();
      if (audio.paused) audio.play().catch(() => {});
    };
    audio.addEventListener('canplay', handleCanPlay);
    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        startPosition: -1,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 6,
        maxLiveSyncPlaybackRate: 1.2,
        maxBufferLength: 12,
        backBufferLength: 0,
      });
      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(audio);
      hls.startLoad(-1);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        tryStartPlayback();
        audio.play().catch(() => {});
      });
      hls.on(Hls.Events.FRAG_BUFFERED, () => {
        tryStartPlayback();
        if (audio.paused) audio.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data?.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          hls.startLoad(-1);
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
        } else {
          hls.destroy();
          hlsRef.current = null;
          pendingPlayRef.current = false;
          setAudioLoading(false);
          setPlaying(false);
        }
      });
    } else if (audio.canPlayType('application/vnd.apple.mpegurl')) {
      audio.src = streamUrl;
      audio.load();
    }
    return () => {
      clearTimeout(playRetryRef.current);
      audio.removeEventListener('canplay', handleCanPlay);
      hls?.destroy();
      hlsRef.current = null;
    };
  }, []);

  useEffect(() => {
    const loadNews = async () => {
      try {
        const response = await fetch(`/api/pop-news?t=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });
        const xml = await response.text();
        const doc = new DOMParser().parseFromString(xml, 'text/xml');
        const items = [...doc.querySelectorAll('item')].slice(0, 4).map((item) => ({
          title: item.querySelector('title')?.textContent?.replace(/\s+-\s+[^-]+$/, '') || 'Pop music update',
          author: item.getElementsByTagName('dc:creator')[0]?.textContent?.trim() || item.querySelector('author')?.textContent?.trim() || '',
          source: item.querySelector('source')?.textContent || 'Pop music news',
          date: item.querySelector('pubDate')?.textContent || '',
          link: item.querySelector('link')?.textContent || '#',
          image: item.getElementsByTagName('media:content')[0]?.getAttribute('url') || item.getElementsByTagName('media:thumbnail')[0]?.getAttribute('url') || item.querySelector('enclosure')?.getAttribute('url') || '',
        }));
        if (items.length) setPopNews(items);
      } catch {}
    };
    loadNews();
  }, []);

  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume; }, [volume]);

  useEffect(() => {
    const loadSchedule = async () => {
      try {
        const response = await fetch(`${apiBase}/station/thaalam_24x7/schedule`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Schedule request failed: ${response.status}`);
        const payload = await response.json();
        const items = Array.isArray(payload) ? payload : payload?.data || payload?.schedule;
        if (!Array.isArray(items) || !items.length) return;
        const selected = selectSchedulePrograms(items);
        setSchedule(selected.map((item, index) => {
          const isNow = item.state === 'NOW';
          return {
          start: formatScheduleTime(scheduleStart(item), scheduleEnd(item)),
          state: item.state,
          name: scheduleName(item),
          description: item.description || item.program?.description || 'Live programming from Thaalam 24x7.',
          icon: [Radio, SkipForward, SkipForward][index % 3],
          featured: isNow,
          };
        }));
      } catch {}
    };
    loadSchedule();
    const refreshTimer = setInterval(loadSchedule, 60 * 1000);
    return () => clearInterval(refreshTimer);
  }, []);

  useEffect(() => {
    const heroEntryTimer = window.setTimeout(() => document.documentElement.classList.add('hero-entry-complete'), 1400);
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.target.classList.contains('chart-card')) {
        const direction = document.documentElement.dataset.scrollDirection || 'down';
        if (entry.isIntersecting && direction === 'down') {
          entry.target.classList.add('is-visible');
          setChartsRevealed(true);
        }
        return;
      }
      if (entry.isIntersecting) {
        entry.target.classList.remove('is-visible');
        void entry.target.offsetWidth;
        entry.target.classList.add('is-visible');
        if (entry.target.classList.contains('chart-card')) setChartsRevealed(true);
      } else {
        entry.target.classList.remove('is-visible');
      }
    }), { threshold: .12, rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('[data-reveal]').forEach((item) => observer.observe(item));
    let previousScrollY = window.scrollY;
    // Do not trigger the hero fall from browser scroll restoration on refresh;
    // it should only begin after an actual downward scroll event.
    let heroFalling = false;
    let heroFallTriggered = false;
    let heroReturning = false;
    let heroReversePlayed = false;
    let userInitiatedScroll = false;
    const root = document.documentElement;
    const onHeroAnimationEnd = (event) => {
      if (!event.animationName.startsWith('hero-return-')) return;
      heroReturning = false;
      root.classList.remove('hero-returning');
    };
    root.addEventListener('animationend', onHeroAnimationEnd);
    const markUserScroll = () => { userInitiatedScroll = true; };
    const onScroll = () => {
      if (!userInitiatedScroll) {
        previousScrollY = window.scrollY;
        return;
      }
      const scrollDelta = window.scrollY - previousScrollY;
      if (scrollDelta === 0) return;
      const direction = scrollDelta > 0 ? 'down' : 'up';
      document.documentElement.dataset.scrollDirection = direction;
      document.documentElement.classList.toggle('scroll-down', direction === 'down');
      document.documentElement.classList.toggle('scroll-up', direction === 'up');
      const heroFallThreshold = window.innerWidth <= 800 ? window.innerHeight * .5 : 8;
      const heroReverseThreshold = window.innerHeight * .5;
      if (direction === 'down' && window.scrollY > heroFallThreshold) {
        heroFalling = true;
        heroFallTriggered = true;
        heroReturning = false;
        heroReversePlayed = false;
      }
      if (direction === 'down') heroReturning = false;
      if (direction === 'up' && heroFallTriggered && !heroReversePlayed && window.scrollY < heroReverseThreshold) {
        heroFalling = false;
        heroReturning = true;
        heroReversePlayed = true;
      }
      document.documentElement.classList.toggle('hero-falling', heroFalling);
      document.documentElement.classList.toggle('hero-returning', heroReturning);
      if (window.scrollY <= 4 && previousScrollY > 4) {
        document.querySelectorAll('[data-reveal]').forEach((item) => item.classList.remove('is-visible'));
      }
      previousScrollY = window.scrollY;
      document.documentElement.style.setProperty('--scroll-y', `${window.scrollY}px`);
      document.documentElement.style.setProperty('--disc-progress', `${Math.min(1, window.scrollY / 700)}`);
      document.documentElement.style.setProperty('--badge-progress', `${Math.min(1, window.scrollY / 80)}`);
      document.documentElement.style.setProperty('--scroll-progress', `${window.scrollY / Math.max(1, document.body.scrollHeight - window.innerHeight)}`);
    };
    window.addEventListener('wheel', markUserScroll, { passive: true });
    document.addEventListener('click', markUserScroll, { passive: true });
    window.addEventListener('touchmove', markUserScroll, { passive: true });
    window.addEventListener('keydown', markUserScroll, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('wheel', markUserScroll);
      document.removeEventListener('click', markUserScroll);
      window.removeEventListener('touchmove', markUserScroll);
      window.removeEventListener('keydown', markUserScroll);
      window.removeEventListener('scroll', onScroll);
      root.removeEventListener('animationend', onHeroAnimationEnd);
      window.clearTimeout(heroEntryTimer);
    };
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

    // Stop the live connection on pause so the next Play starts a fresh
    // segment request from the live edge.
    if (!audio.muted && !audio.paused) {
      audio.pause();
      hlsRef.current?.stopLoad();
      pendingPlayRef.current = false;
      setPlaying(false);
      return;
    }

    pendingPlayRef.current = true;
    setAudioLoading(true);
    audio.muted = false;
    hlsRef.current?.startLoad(-1);

    try {
      await audio.play();
      radioStartedRef.current = true;
    } catch (error) {
      if (error?.name === 'NotAllowedError') {
        pendingPlayRef.current = false;
        setAudioLoading(false);
        setPlaying(false);
      } else {
        clearTimeout(playRetryRef.current);
        playRetryRef.current = setTimeout(() => {
          if (!pendingPlayRef.current) return;
          hlsRef.current?.startLoad(-1);
          audio.play().catch(() => {});
        }, 750);
      }
    }
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

  const currentShowName = schedule.find((show) => show.state === 'NOW')?.name;
  const [heroLabel, setHeroLabel] = useState({ mode: 'idle', current: null, previous: null });
  const heroShowRef = useRef(null);

  useEffect(() => {
    if (!currentShowName) return;
    if (heroShowRef.current === null) {
      heroShowRef.current = currentShowName;
      setHeroLabel({ mode: 'initial', current: currentShowName, previous: null });
      return;
    }
    if (heroShowRef.current === currentShowName) return;
    const from = heroShowRef.current;
    heroShowRef.current = currentShowName;
    setHeroLabel({ mode: 'change', current: currentShowName, previous: from });
    const timer = window.setTimeout(() => setHeroLabel({ mode: 'steady', current: currentShowName, previous: null }), 1100);
    return () => window.clearTimeout(timer);
  }, [currentShowName]);

  return <>
    <audio ref={audioRef} autoPlay muted preload="auto" playsInline onPlaying={() => { clearTimeout(playRetryRef.current); if (pendingPlayRef.current) audioRef.current.muted = false; pendingPlayRef.current = false; setAudioLoading(false); setPlaying(!audioRef.current.muted); }} onTimeUpdate={() => { const audio = audioRef.current; if (audio && !audio.paused && audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) { pendingPlayRef.current = false; setAudioLoading(false); setPlaying(!audio.muted); } }} onWaiting={() => setAudioLoading(true)} onPause={() => { if (!pendingPlayRef.current) { setAudioLoading(false); setPlaying(false); } }} onError={() => { clearTimeout(playRetryRef.current); pendingPlayRef.current = false; setAudioLoading(false); setPlaying(false); }} />
    <audio ref={previewAudioRef} preload="none" />
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="site-header"><a className="brand" href="#top"><BrandMark /><span>THAALAM 24x7</span></a><nav><a href="#listen" onClick={(event) => navigateToSection(event, '#listen')}>Listen</a><a href="#charts" onClick={(event) => navigateToSection(event, '#charts')}>Charts</a><a href="#shows" onClick={(event) => navigateToSection(event, '#shows')}>Shows</a><a href="#news" onClick={(event) => navigateToSection(event, '#news')}>News</a></nav><button className="header-play" onClick={toggleAudio}>{audioLoading ? <span className="audio-spinner" aria-label="Loading" /> : playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />} {playing ? 'Pause live' : 'Play live'}</button></header>
    <main id="main">
      <section className="hero" id="top"><div className="hero-copy"><p className={`eyebrow hero-live-label${heroLabel.mode === 'initial' ? ' has-show' : ''}${heroLabel.mode === 'change' ? ' program-change' : ''}`}><span className="live-dot" /><span key={`${heroLabel.mode}-${heroLabel.previous || ''}-${heroLabel.current || ''}`} className="hero-live-words">{heroLabel.mode === 'change' ? <><span className="hero-show-out">{heroLabel.previous}</span><span className="hero-show-in">{heroLabel.current}</span></> : heroLabel.mode === 'initial' ? <><span className="hero-live-default">Live Worldwide</span><span className="hero-current-show">{heroLabel.current}</span></> : <span className="hero-current-show">{heroLabel.current || 'Live Worldwide'}</span>}</span></p><h1>We play the<br />best</h1><p className="hero-intro">Catch the greatest hits, nonstop 24x7, live worldwide</p><div className="hero-actions"><button className="button button-primary" onClick={toggleAudio}>{audioLoading ? <span className="audio-spinner" aria-label="Loading" /> : playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />} {playing ? 'Pause radio' : 'Listen live'}</button><a className="text-link" href="#charts" onClick={(event) => navigateToSection(event, '#charts')}>See the charts <ArrowUpRight size={16} /></a></div></div><div className="hero-art"><div className="record-shell"><div className="record"><div className="record-label"><DiscLogo /></div></div></div><div className="hero-sticker">ON AIR<br /><span>24 / 7</span></div></div><div className="hero-foot"><span></span><span>Scroll to live room</span><span className="hero-line" /></div></section>
      <section className="player-section" id="listen"><div className="section-intro"><p className="eyebrow">The live room</p><h2>Now playing</h2></div><div className="player-card" data-reveal="rise"><div className="player-art"><img draggable="false" src={currentTrack.cover || fallbackCover} alt="Current album artwork" onError={(e) => { e.currentTarget.src = fallbackCover; }} /><div className="art-disc"><Disc3 size={36} /></div></div><div className="player-info"><span className="live-label"><span className="live-dot" /> On air now</span><h3>{currentTrack.title}</h3><p>{currentTrack.artist}</p><div className="waveform">{Array.from({ length: 34 }, (_, i) => <span key={i} style={{ '--i': i }} />)}</div><div className="player-controls"><button className="play-button" onClick={toggleAudio}>{playing ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}</button><div className="track-time"></div><Volume2 size={18} /><input aria-label="Volume" type="range" min="0" max="1" step=".01" value={volume} onChange={(e) => setVolume(Number(e.target.value))} /></div></div></div></section>
      <section className="chart-section" id="charts"><div className="chart-header"><div><p className="eyebrow">Global pop · trending now</p><h2>The chart, <span>right now</span></h2></div></div><div className="chart-grid">{chartTracks.map((track, index) => <article className={`chart-card${chartsRevealed ? ' is-visible' : ''}${previewTrack?.title === track.title ? ' is-previewing' : ''}`} data-reveal="rise" style={{ '--delay': `${index * 90}ms` }} key={`${track.rank}-${track.title}`}><div className="chart-rank">{track.rank}</div><button className="chart-cover" onClick={() => togglePreview(track)} aria-label={`${previewTrack?.title === track.title ? 'Pause' : 'Play'} ${track.title}`}><img draggable="false" src={track.cover || fallbackCover} alt={`${track.title} album art`} onError={(e) => { e.currentTarget.src = fallbackCover; }} /><span className="chart-play">{previewTrack?.title === track.title ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}</span></button><div className="chart-meta"><h3>{track.title}</h3><p>{track.artist}</p></div></article>)}</div></section>
      <section className="shows-section" id="shows"><div className="shows-copy"><p className="eyebrow">Broadcast schedule</p><h2>What's on<br /><span>Thaalam</span></h2><p>Shows curated by our experts</p><a className="button button-light" href="#shows" onClick={(event) => navigateToSection(event, '#shows')}>See the schedule <ArrowUpRight size={16} /></a></div><div className="show-list">{schedule.slice(0, 3).map((show, index) => { const Icon = show.state === 'NOW' ? Radio : show.state === 'LATER' ? FastForward : SkipForward; return <div className={`show-row${show.featured || show.state === 'NOW' ? ' featured is-now' : ''}`} data-reveal="side" style={{ '--delay': `${index * 120}ms` }} key={`${show.state || index}-${index}-${show.start}-${show.name}`}><span><small>{show.state || ['NOW', 'NEXT', 'LATER'][index]}</small><time>{show.start}</time></span><div><h3>{show.name}</h3></div><Icon size={20} /></div>; })}</div></section>
      <section className="trending-section" id="news"><div className="trending-copy"><p className="eyebrow">Pop music, right now</p><h2>What’s<br /><span>moving</span></h2><p>The latest stories, releases, and moments shaping pop culture beyond the playlist.</p></div><div className="news-list">{popNews.length ? popNews.map((story, index) => <a className="news-item" data-reveal="rise" href={story.link} target="_blank" rel="noreferrer" key={`${story.title}-${index}`}><span className="news-source">{story.author || story.source}</span><strong>{story.title}</strong><small className="news-date">{formatNewsDate(story.date)}</small><ArrowUpRight size={16} /></a>) : <div className="news-empty"><Disc3 size={24} /><span>Loading…</span></div>}</div></section>
    </main>
    <footer className="site-footer"><a className="brand" href="#top"><BrandMark /><span>THAALAM 24x7</span></a><a className="footer-player-link" href="https://web.thaalam24x7.in">Web Player <ArrowUpRight size={14} aria-hidden="true" /></a><span>© 2026 Thaalam 24x7</span></footer>
  </>;
}

createRoot(document.getElementById('root')).render(<App />);
