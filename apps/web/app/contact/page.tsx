export default function Contact() {
  return (
    <main className="legal">
      <a className="brand" href="/">
        <span>●</span> MapsBridge
      </a>
      <h1>İletişim</h1>
      <p>
        Soru, öneri, iş birliği veya destek talepleriniz için bize ulaşabilirsiniz. En hızlı yanıt
        için e-posta ile yazmanız yeterli.
      </p>

      <h2>E-posta</h2>
      <p>
        Doğrudan{" "}
        <a href="mailto:destek@mapsbridge.com">destek@mapsbridge.com</a> adresine yazabilirsiniz.
      </p>

      <h2>Mesaj gönder</h2>
      <p>
        Aşağıdaki form, varsayılan e-posta uygulamanızı açarak mesajınızı hazırlar. E-posta
        uygulamanız yoksa yukarıdaki adrese doğrudan yazabilirsiniz.
      </p>
      <form action="mailto:destek@mapsbridge.com" method="post" encType="text/plain">
        <p>
          <label htmlFor="contact-subject">Konu</label>
          <br />
          <input
            id="contact-subject"
            name="subject"
            type="text"
            required
            placeholder="Mesajınızın konusu"
          />
        </p>
        <p>
          <label htmlFor="contact-body">Mesaj</label>
          <br />
          <textarea
            id="contact-body"
            name="body"
            rows={6}
            required
            placeholder="Mesajınızı buraya yazın"
          />
        </p>
        <p>
          <button type="submit">E-posta uygulamasında aç</button>
        </p>
      </form>

      <p>
        Gizlilik uygulamalarımız için{" "}
        <a href="/privacy/">gizlilik politikamıza</a> göz atabilirsiniz.
      </p>
    </main>
  );
}
