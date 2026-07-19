//! Social platform publishers — native Rust ports of `src/publishers/*.js`.

pub mod instagram;
pub mod youtube;

pub use instagram::InstagramPublisher;
pub use youtube::YouTubePublisher;
