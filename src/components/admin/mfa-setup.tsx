'use client';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { useState } from 'react';

type Totp = { factorId: string; challengeId: string; qr: string };

export function MfaSetup({
  url,
  publishableKey,
}: {
  url: string;
  publishableKey: string;
}) {
  const router = useRouter();
  const [totp, setTotp] = useState<Totp | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const client = createBrowserClient(url, publishableKey);

  async function begin() {
    setPending(true);
    setError('');
    const factors = await client.auth.mfa.listFactors();
    const verified = factors.data?.totp.find(
      (factor) => factor.status === 'verified',
    );
    if (verified) {
      const challenge = await client.auth.mfa.challenge({
        factorId: verified.id,
      });
      if (challenge.error) setError('Unable to start MFA verification.');
      else
        setTotp({
          factorId: verified.id,
          challengeId: challenge.data.id,
          qr: '',
        });
    } else {
      const enrollment = await client.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Flyco staff',
      });
      if (enrollment.error) setError('Unable to enroll an authenticator.');
      else {
        const challenge = await client.auth.mfa.challenge({
          factorId: enrollment.data.id,
        });
        if (challenge.error) setError('Unable to start MFA verification.');
        else
          setTotp({
            factorId: enrollment.data.id,
            challengeId: challenge.data.id,
            qr: enrollment.data.totp.qr_code,
          });
      }
    }
    setPending(false);
  }

  async function verify() {
    if (!totp || !/^\d{6}$/.test(code)) {
      setError('Enter the six-digit authenticator code.');
      return;
    }
    setPending(true);
    setError('');
    const result = await client.auth.mfa.verify({
      factorId: totp.factorId,
      challengeId: totp.challengeId,
      code,
    });
    if (result.error) {
      setError('The authenticator code was not accepted.');
      setPending(false);
      return;
    }
    router.push('/admin');
    router.refresh();
  }

  return (
    <section className="admin-panel admin-mfa" aria-labelledby="mfa-title">
      <p className="eyebrow">Strong authentication required</p>
      <h1 id="mfa-title">Verify staff access</h1>
      <p>
        Moderation data and actions require an AAL2 session. Use a TOTP
        authenticator; Flyco never asks for the authenticator secret.
      </p>
      {!totp ? (
        <button
          className="button"
          type="button"
          onClick={begin}
          disabled={pending}
        >
          {pending ? 'Preparing…' : 'Set up or verify MFA'}
        </button>
      ) : (
        <div className="form-stack">
          {totp.qr ? (
            <>
              <p>
                Scan this one-time enrollment QR code with your authenticator
                app.
              </p>
              <Image
                src={totp.qr}
                alt="TOTP enrollment QR code"
                width={220}
                height={220}
                unoptimized
              />
            </>
          ) : null}
          <label>
            Authenticator code
            <input
              className="field"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, ''))
              }
            />
          </label>
          <button
            className="button"
            type="button"
            onClick={verify}
            disabled={pending}
          >
            {pending ? 'Verifying…' : 'Verify and continue'}
          </button>
        </div>
      )}
      {error ? (
        <p className="alert-danger" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
