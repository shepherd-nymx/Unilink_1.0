
/*
  # Fix driver_requests RLS INSERT policy

  The INSERT policy for driver_requests table currently allows any authenticated user to insert records with any driver_id.
  This violates the principle of restrictive RLS security.

  Changes:
  - Update "Allow driver request insertion" policy to enforce that only the driver matching driver_id can insert
  - Add proper WITH CHECK clause to validate driver ownership
  - Maintain backward compatibility with existing policies for READ and UPDATE operations
*/

DROP POLICY IF EXISTS "Allow driver request insertion" ON driver_requests;

CREATE POLICY "Drivers can create requests for themselves"
  ON driver_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = driver_id);
